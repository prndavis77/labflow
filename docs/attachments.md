# LabFlow Attachment Backend

LabFlow includes a generic research attachment backend for storing files associated with laboratory records.

The attachment backend is designed for research evidence, experiment exports, protocols, instrument documents, reports, images, reference files, and other supporting material.

## Architecture

Attachment metadata is stored in PostgreSQL.

File content is stored separately in a private Cloudflare R2 bucket.

The backend does not make the bucket public. Instead, it creates short-lived signed URLs for direct uploads and downloads.

The normal upload flow is:

1. The authenticated client requests an attachment upload.
2. The backend validates the target record, file metadata, MIME type, file size, organization, and user access.
3. The backend creates a pending attachment record.
4. The backend returns a short-lived signed upload URL.
5. The client uploads the file directly to Cloudflare R2.
6. The client calls the completion endpoint.
7. The backend checks the stored object and marks the attachment available.

The normal download flow is:

1. The authenticated client requests a download URL.
2. The backend loads the attachment within the user’s organization.
3. The backend checks access to the attachment’s linked record.
4. The backend confirms that the object still exists in storage.
5. The backend returns a short-lived signed download URL.

## Supported target records

The generic attachment system can associate files with supported LabFlow entity types through:

```text
entityType
entityId
```

Access to an attachment follows access to the record it belongs to.

For example, a user may view or download an experiment attachment only when that user can view the associated experiment.

The backend always derives the organization from the authenticated user. Clients cannot select another organization by supplying an organization ID.

## Attachment API

All attachment endpoints require authentication.

### Initiate an upload

```http
POST /api/attachments/uploads
```

Example request body:

```json
{
  "entityType": "experiment",
  "entityId": 42,
  "originalFileName": "GC-MS Run 04.csv",
  "mimeType": "text/csv",
  "fileSize": 1024,
  "category": "raw_data",
  "description": "Raw instrument export."
}
```

Successful responses contain:

- The pending attachment metadata
- A signed upload URL
- The required HTTP method
- Required upload headers
- The signed URL expiration period

The response does not expose R2 credentials.

### Complete an upload

```http
POST /api/attachments/:id/complete
```

The backend confirms that:

- The attachment exists
- The attachment belongs to the authenticated user’s organization
- The attachment is still pending
- The pending upload has not expired
- The user still has access to the target record
- The R2 object exists
- The stored file size matches the expected size

After successful verification, the attachment status changes to `available`.

### List attachments

```http
GET /api/attachments
```

Supported filters include the attachment target and other filters implemented by the controller.

Typical target query:

```http
GET /api/attachments?entityType=experiment&entityId=42
```

Only attachments that the authenticated user is permitted to view are returned.

### Get one attachment

```http
GET /api/attachments/:id
```

The attachment must belong to the authenticated user’s organization, and the user must be able to view the linked target record.

Internal storage details such as the storage key, checksum, and ETag are not returned.

### Create a signed download URL

```http
GET /api/attachments/:id/download
```

The backend verifies the R2 object before creating the signed URL.

The response contains:

```json
{
  "status": "success",
  "data": {
    "attachment": {},
    "download": {
      "url": "short-lived-signed-url",
      "method": "GET",
      "expiresIn": 60
    }
  }
}
```

Signed URLs must be treated as temporary bearer credentials. They should not be stored in database records, audit metadata, browser local storage, analytics events, or application logs.

### Update attachment metadata

```http
PATCH /api/attachments/:id
```

Editable fields:

```text
category
description
```

Example:

```json
{
  "category": "result",
  "description": "Processed and reviewed results."
}
```

Storage keys, filenames, file types, sizes, target linkage, upload status, and uploader identity cannot be changed through this endpoint.

Researchers can update only attachments that they uploaded. Admins and supervisors may manage attachments when their target-record permissions allow it.

### Archive an attachment

```http
POST /api/attachments/:id/archive
```

Archiving is a soft-delete operation.

The attachment record is updated with:

```text
isArchived
archivedAt
archivedById
```

The physical R2 object is not deleted by the archive endpoint.

Repeated archive requests are idempotent after the caller’s access and ownership permissions have been checked.

## Upload states

Attachment upload status values include:

```text
pending
available
failed
```

### Pending

The upload was initiated, but completion has not been confirmed.

### Available

The uploaded object was verified and is available for permitted users.

### Failed

The upload did not complete successfully or an expired pending upload was cleaned up.

## Expired upload cleanup

Pending uploads include an expiration timestamp.

The cleanup command is:

```bash
npm run cleanup:attachments
```

The cleanup service:

1. Selects expired pending attachments in batches.
2. Reloads and locks each candidate.
3. Confirms that the attachment is still pending and expired.
4. Deletes any partial R2 object.
5. Changes the attachment status to `failed`.
6. Clears the upload expiration timestamp.
7. Continues processing when another attachment fails.

Storage deletion failures leave the database row pending so a later cleanup run can retry.

The command is a one-shot process and exits when the batch has been processed. It is intended to be run by a scheduler rather than through a permanent timer inside the API server.

## Security controls

The attachment backend includes:

- Authentication on every attachment route
- Organization-scoped database queries
- Linked-record access checks
- Attachment ownership checks for researcher mutations
- Private object storage
- Short-lived signed upload and download URLs
- File-size validation
- MIME-type validation
- Filename sanitization
- Organization-scoped storage keys
- Row locking for completion, archive, metadata mutation, and cleanup operations
- Audit logging for upload initiation, upload completion, signed download creation, metadata changes, and archive actions
- Removal of storage keys, ETags, and checksums from public API responses
- Soft-delete archive behaviour
- Expired pending-upload cleanup

## Audit events

Attachment user actions use these audit actions:

```text
attachment.upload_initiated
attachment.upload_completed
attachment.download_url_created
attachment.metadata_updated
attachment.archived
```

Audit metadata must not include:

```text
R2 credentials
signed URLs
storage keys
checksums
ETags
secret environment variables
```

The pending-upload cleanup process is a system maintenance action. It does not create a fake user identity for audit logging.

## Cloudflare R2 requirements

The R2 bucket must remain private.

The backend requires an R2 API token with the minimum object permissions needed to:

- Upload objects
- Read object metadata
- Download objects
- Delete expired partial uploads

Limit the token to the LabFlow attachment bucket whenever possible.

The browser uploads directly to the signed R2 URL, so the bucket must have a CORS policy allowing the deployed frontend origin to perform the required upload request.

Do not use wildcard origins for a production deployment when the frontend has a fixed domain.

## Environment variables

Required storage settings:

```text
ATTACHMENT_STORAGE_PROVIDER
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Configurable attachment settings:

```text
ATTACHMENT_MAX_FILE_SIZE_BYTES
ATTACHMENT_PENDING_TTL_MINUTES
ATTACHMENT_UPLOAD_URL_TTL_SECONDS
ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS
ATTACHMENT_CLEANUP_BATCH_SIZE
```

Production credentials must be stored in the deployment platform’s secret environment-variable system. They must not be committed to Git.

## Operational checks

Run the complete backend test suite:

```bash
npm test -- --runInBand
```

Run the cleanup process manually:

```bash
npm run cleanup:attachments
```

An empty cleanup result is valid:

```text
Starting expired attachment cleanup.
Expired attachment cleanup completed. {
  scanned: 0,
  cleaned: 0,
  skipped: 0,
  failed: 0
}
```

A non-zero `failed` count causes the cleanup process to exit unsuccessfully so the scheduler can record the run as failed.

## Current limitations

The current backend does not yet include:

- Frontend attachment components
- Upload progress UI
- Automatic malware scanning
- File-content inspection
- File versioning
- Physical deletion of archived objects
- Retention-policy automation
- Storage quota enforcement per organization
- Attachment search across all target types
- System-actor audit records for maintenance tasks
- Large multipart uploads for very large instrument files

The current file-size limit is intended for the initial attachment release. Larger raw instrument datasets may require multipart upload support and different storage limits later.
