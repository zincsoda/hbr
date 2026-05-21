# Home Bus Routes Display

A React application that displays real-time bus arrival information for KMB (Kowloon Motor Bus) routes in Hong Kong.

## Routes Displayed

- **77K** Yuen Long - Sheung Shui
- **77K** Sheung Shui - Yuen Long
- **54** Sheung Tsuen - Yuen Long
- **251B** Sheung Tsuen - Pat Heung Road

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure routes (either option works):

   **In the app:** click **Add route / stop**, fill route number, KMB stop ID, direction (outbound/inbound), labels, and destination filter (must match ETA `dest_en` for that direction). User-added rows persist in **`localStorage`** (`hbr_extra_routes`). Baseline rows still ship from `src/routes.json`.

   **Or edit bundled defaults:** adjust `src/routes.json`:
   - Each route typically needs `route`, `stop_id`, `service_type`, `bound` (or `direction` as `O`/`I`), `stopName`, `destination`, `routeName`, and `id`
   - The default signage includes Wang Toi Shan / Lo Uk Tseun examples

### Running the Application

Start the React app:
```bash
npm start
```

The React app will be available at `http://localhost:3000`

## Configuration

Baseline routes ship in `src/routes.json`. For ad-hoc rows without rebuilding, use **Add route / stop** (saved separately in `localStorage` under `hbr_extra_routes`).

Example row shape matching the JSON defaults:

```json
[
  {
    "route": "77K",
    "stop_id": "E125CB2691C02A61",
    "service_type": 1,
    "direction": "O",
    "stopName": "Wang Toi Shan",
    "destination": "Sheung Shui",
    "routeName": "77K Yuen Long - Sheung Shui",
    "id": 1
  }
]
```

## Data Source

This application uses the [KMB Open Data API](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) provided by the Hong Kong Transport Department.
