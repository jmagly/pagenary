# Local dataset authoring

Open **Import pages** to review a local JSON page collection and explicitly
approve writes to this browser's library. Ordinary documentation routes do not
open the database or load the import controls.

A source file contains an `items` array:

```json
{
  "items": [
    { "id": "getting-started", "title": "Getting started", "text": "Your first local page." }
  ]
}
```

Stable page IDs let later imports update existing records. Preview is read-only.
The default conflict policy preserves existing content; version and replacement
policies require approval. Cancel stops before the next atomic batch. Retry
reuses committed receipts and checkpoints; changed input requires a new plan.

Imported notes live in the canonical RecordStore. This example does not enable
semantic inference or terminal purge. Portable `record-v1` exports omit live
source identities and are not complete backups; retain the export loss receipt.
