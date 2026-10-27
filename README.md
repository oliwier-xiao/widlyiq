# WidlyIQ

Polish Tech Compensation ETL & AI Feature Store. Pipeline w Pythonie pobiera oferty pracy IT, kursy NBP i płace GUS, czyści je i zamienia w macierz cech, a dashboard w Next.js 16 pokazuje wynik. Zwykły programista dostaje prostą odpowiedź (ile zarabia jego profil w regionie i ile to razy średnia GUS). Oceniający może zejść poziom niżej, aż do linii kodu, która policzyła daną liczbę.

## Szybki start

Wymagania: Node.js 22+, Python 3.12+, [uv](https://docs.astral.sh/uv/).

```bash
uv sync                  # .venv z pandas, NumPy, scikit-learn, Matplotlib, Seaborn
npm install
npm run etl:snapshot     # offline, ze snapshotów, ok. 5 s
npm run dev              # http://localhost:3000
```

`npm run etl` uruchamia tryb live: każde źródło jest pobierane z sieci, a przy błędzie (brak sieci, 403, 429, 5xx, timeout, nieznany format) to jedno źródło przechodzi na snapshot. Pipeline można też odpalić z dashboardu przyciskiem **Uruchom pipeline**; Route Handler `POST /api/etl/run` uruchamia wtedy `python -m python_etl.run_pipeline --events` i strumieniuje postęp jako NDJSON.

Testy: `npm run test:etl` (pytest), `npm run typecheck`, `npm run lint`.

## Architektura

| Warstwa | Ścieżka | Rola |
|---|---|---|
| Ekstrakcja | `python_etl/ingestors.py` | REST portali, XML NBP, XLSX GUS, fallback do `python_etl/snapshots/` |
| Transformacja | `python_etl/cleaning.py` | harmonizacja, schemat, deduplikacja, waluty, imputacja, IQR / Z-Score, tiery |
| Cechy | `python_etl/features.py` | one-hot, ranga ordinalna, StandardScaler, macierz rzadka X.T @ X |
| Model | `python_etl/model.py` | RidgeCV, bias portali z reszt, wykres diagnostyczny Matplotlib |
| Zapis | `python_etl/database.py` | jedna transakcja SQLite (WAL), eksport CSV / JSON / XLSX |
| CLI | `python_etl/run_pipeline.py` | orkiestracja i zdarzenia NDJSON |
| Dane | `data/widlyiq.db` | jedyne źródło prawdy dla UI |
| Routing | `src/app/` | tylko kompozycja RSC i Route Handlery |
| Widoki | `src/features/*` | `market-analytics`, `etl-lab`, `skill-graph`, `salary-estimator` |
| Prymitywy | `src/shared/` | `db/sqlite.ts`, `ui/`, `lib/formatters.ts` |

Python i Next.js komunikują się tylko przez plik SQLite i podproces uruchamiany przez Route Handler. Dashboard otwiera bazę tylko do odczytu; pipeline zapisuje cały przebieg w jednej transakcji w trybie WAL, więc UI widzi stary albo nowy stan, nigdy pół na pół.

## Źródła danych

| Źródło | Endpoint | Format | Stan na 20.10.2026 |
|---|---|---|---|
| No Fluff Jobs | `nofluffjobs.com/api/posting` | JSON | live działa, ok. 18 000 ogłoszeń |
| Just Join IT | `api.justjoin.it/v2/user-panel/offers` | JSON | HTTP 503, fallback do snapshotu |
| SOLID.Jobs | `solid.jobs/api/offers` | JSON | HTTP 404 (brak publicznego API), fallback |
| NBP | `api.nbp.pl/api/exchangerates/tables/A` | XML | live działa |
| GUS BDL | `bdl.stat.gov.pl/api/v1`, zmienna 64428 | JSON, zapis do XLSX | live działa |

Snapshoty ofert (`nofluffjobs.json`, `justjoinit.json`, `solidjobs.json`, razem 1 307 rekordów) są **syntetyczne** i mają strukturę natywnych API portali. Generuje je `python_etl/snapshots/build_snapshots.py` ze znanego modelu płac (`ground_truth.json`), z celowo wstawionymi anomaliami: duplikaty między portalami, braki widełek, zamienione od/do, kwoty w tysiącach, stawki godzinowe, waluty obce, skrajne wartości, błędy schematu i aliasy skilli. Podkarpackie jest nadreprezentowane celowo, żeby perspektywa regionalna miała próbę. UI oznacza takie dane jako syntetyczne.

Snapshoty NBP (`nbp_table_a.xml`, tabela 204/A/NBP/2026) i GUS (`gus_bdl_wages.xlsx`, lata 2023 do 2025) to kopie prawdziwych tabel publicznych. Dane GUS są udostępniane na licencji CC BY 4.0. Danych pobranych na żywo z portali repozytorium nie przechowuje: trafiają tylko do lokalnej bazy.

## Etapy pipeline i kotwice

Każdy mechanizm ma jednoliniową kotwicę: Ctrl+Shift+F na nazwie w nawiasie kwadratowym prowadzi do kodu. Kotwice żyją tylko w kodzie źródłowym; dashboard nie pokazuje kodu.

| Etap | Kotwica | Co robi |
|---|---|---|
| extract | `[extract]`, `[xml-nbp]`, `[xlsx-gus]` | pobranie lub snapshot; powód fallbacku zapisany w `raw_ingestion_logs` |
| verify-schema | `[verify-schema]` | odrzuca brak tytułu, ujemne kwoty, nieznane waluty; naprawia zamienione widełki i kwoty w tysiącach |
| dedupe | `[verify-schema]` | ta sama oferta na kilku portalach lub w kilku miastach; zostaje kopia z widełkami |
| normalize-nbp | `[normalize-nbp]` | kurs średni NBP do PLN; godzina × 168 h, rok / 12, dzień × 21 |
| impute-median | `[impute-median]` | brak widełek uzupełniony medianą grupy kategoria × poziom × umowa, `is_imputed = 1` |
| filter-iqr | `[filter-iqr]` | płotki IQR (k = 1,5) na log(płacy) w grupach, Z-Score \|z\| > 3 dla zdegenerowanych grup |
| classify-tier | `[classify-tier]` | kategoria z tytułu i stacku, tier S/A/B/C według krotności płacy GUS |
| onehot-encode | `[onehot-encode]` | skille (top 40), kategoria, umowa, poziom; StandardScaler tylko na cechach ciągłych |
| cooccur-matrix | `[cooccur-matrix]` | X.T @ X na `scipy.sparse`, lift, Jaccard, średnia płaca pary |
| ml-ridge | `[ml-ridge]` | RidgeCV, alfa z 5-krotnej walidacji krzyżowej |
| plot-mpl | `[plot-mpl]` | `public/diagnostics/iqr_distribution.svg` |
| load-sqlite | `[sqlite-query]` | zapis w jednej transakcji; ta sama kotwica oznacza odczyty w Next.js |

Wynik w trybie snapshot: 1 307 surowych, 18 błędów schematu, 78 duplikatów, 140 imputacji, 40 outlierów, 1 171 czystych ofert.
Przebieg live z 20.10.2026: 18 001 prawdziwych ogłoszeń z No Fluff Jobs plus snapshoty Just Join IT i SOLID.Jobs dały 5 064 czyste oferty, bo deduplikacja scaliła kopie tej samej oferty publikowanej osobno dla każdego miasta.

## Tabele SQLite

| Tabela | Zawartość |
|---|---|
| `raw_ingestion_logs` | jedno źródło na przebieg: tryb live/snapshot, HTTP status, powód fallbacku, rekordy, bajty, czas |
| `offers_raw` | rekordy po harmonizacji, przed czyszczeniem, z surowym JSON (do inspektora Raw vs Clean) |
| `offers_clean` | oferty po wszystkich etapach, z `transform_log` opisującym każdą zmianę |
| `offer_skills` | relacja oferta, skill (po normalizacji aliasów) |
| `ai_feature_matrix` | macierz cech modelu, jeden wiersz na ofertę |
| `rejected_outliers` | odrzucone rekordy z etapem, powodem, płotkami i z-score |
| `skill_cooccurrence` | wynik X.T @ X: liczba, lift, Jaccard, średnia płaca pary |
| `skill_stats` | popyt, mediana, P25 i P75, popyt w Podkarpackiem, waga Ridge, kolejność heatmapy |
| `gus_benchmarks` | przeciętne wynagrodzenie brutto według województw i lat |
| `ml_feature_weights` | wagi Ridge w PLN miesięcznie oraz średnia i skala dla cech skalowanych |
| `portal_bias` | mediana reszt modelu dla każdego portalu |
| `pipeline_runs`, `pipeline_stages` | historia przebiegów i etapów |

## Model

RidgeCV przewiduje miesięczną płacę w PLN. Cechy binarne nie są skalowane, więc waga skilla czyta się wprost jako premię w złotych przy pozostałych cechach stałych. Na snapshotach: R² = 0,773 i MAE = 3 279 zł na zbiorze testowym (20%). Ponieważ snapshoty pochodzą ze znanego modelu, pipeline sprawdza też, czy Ridge odtwarza prawdziwe premie generatora: korelacja Pearsona r = 0,79 dla 40 skilli.

## Decyzje metodologiczne

- **IQR na logarytmie.** Płace mają rozkład zbliżony do log-normalnego; płotki na surowej skali odcinałyby uczciwe wysokie stawki, a przepuszczały zaniżone.
- **Imputacja przed IQR.** Mediana jest odporna na outliery, więc uzupełnienie braków przed filtrem nie przenosi błędów. Imputowane wiersze nie biorą udziału w wyznaczaniu płotków ani percentyli.
- **168 godzin.** Stawki godzinowe B2B przelicza się na miesiąc przy pełnym etacie (21 dni × 8 h).
- **Krotność GUS jest orientacyjna.** GUS podaje brutto UoP, a oferty B2B są netto na fakturze; dashboard mówi o tym wprost.
- **Próg n = 10.** Poniżej tego progu dashboard nie pokazuje percentyli, bo P10 i P90 byłyby pojedynczymi ofertami.

## Dashboard

- **Rynek** (start): pole wszystkich ofert w torach Junior do Lead, pomarańczowy odczyt mediany z krotnością GUS i różnicą do Polski, ranking województw, bias portali.
- **ETL Lab**: uruchamianie pipeline z podglądem etapów na żywo, lejek rekordów, źródła z powodami fallbacku, inspektor Raw vs Clean, wykres diagnostyczny Matplotlib.
- **Skill Graph**: popyt a płaca dla każdego skilla oraz interaktywna heatmapa X.T @ X, ułożona grupowaniem hierarchicznym (average linkage na 1 − Jaccard) i podzielona szwami na 8 klastrów nazwanych od dominującej kategorii ofert.
- **Estymator**: kalkulator Ridge dla wybranego stacku (premia techniczna w PLN, krotność GUS) i eksport macierzy cech do CSV, JSON i XLSX.

Wstęga pipeline pod górnym paskiem pokazuje bilans rekordów z ostatniego przebiegu na każdym widoku; kliknięcie etapu otwiera ETL Lab na tym etapie.
