# World Coin Collection

Independent static coin catalog for `coins-mp/world-coin-collection`.

## Publish

Upload `index.html`, `style.css`, `app.js`, `.nojekyll`, and the `data` folder to the repository root. In Settings → Pages select Deploy from a branch, `main`, `/ (root)`.

Expected URL: https://coins-mp.github.io/world-coin-collection/

The header links to the Euro Coin Collection at https://coins-mp.github.io/.

## Coin data

`data/coins.json` starts as an empty array. Every record requires a unique `id`, `country`, `continent`, and `denomination`.

Allowed continents: Africa, Asia, Europe, North America, South America, Oceania. Assign a continent explicitly; the site does not infer it from country names.

Allowed statuses: `collection`, `missing`, `duplicate`.

Example record (documentation only):

```json
{
  "id": "world-001",
  "country": "Canada",
  "countryCode": "CA",
  "continent": "North America",
  "year": 2020,
  "denomination": "1 dollar",
  "name": "",
  "condition": "VF",
  "status": "collection",
  "imageFile": "world-001.jpg",
  "description": "",
  "notes": ""
}
```

Images go in `images/coins/<Country>/<imageFile>`, for example `images/coins/Canada/world-001.jpg`. An empty imageFile displays a placeholder. Unknown year is an empty string.

The catalog searches country, coin name, denomination, and year. It does not search descriptions or notes. Currency denominations remain text; values from different currencies are not combined or compared.

## Local preview

Run `python3 -m http.server 8766 --bind 127.0.0.1` from this folder and visit http://127.0.0.1:8766/.

This preview command has no automatic shutdown. The Euro catalog's existing launcher and server are separate.

## Scope

This first version includes continent navigation, filters, card and table views, dark theme, coin details, and navigation between catalogs. A separate world-coin admin, local synchronization, and automatic shutdown are not implemented in this version. The existing Euro coin server must not be reused to write world coin data.

