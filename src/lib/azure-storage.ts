import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'

const ACCOUNT = 'avawhatsappstorage20487'
const CONTAINER = 'saarthi-media'
const KEY = process.env.AZURE_STORAGE_KEY!

// Ensure the container exists with public-blob read access exactly once per
// process. Without this, a missing container makes every upload throw
// ContainerNotFound — which callers catch and skip, silently dropping media.
// `access: 'blob'` makes uploaded URLs anonymously readable so the public site
// can render them (the storage account must allow blob public access).
let _ensure: Promise<unknown> | null = null
function getContainer(): ContainerClient {
  const connStr = `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT};AccountKey=${KEY};EndpointSuffix=core.windows.net`
  const container = BlobServiceClient.fromConnectionString(connStr).getContainerClient(CONTAINER)
  if (!_ensure) {
    _ensure = container
      .createIfNotExists({ access: 'blob' })
      .catch((e: unknown) => {
        // Already exists or insufficient perms — proceed; the upload will
        // surface a real error if the container is genuinely unusable.
        console.error('[azure-storage] ensure container:', e instanceof Error ? e.message : e)
      })
  }
  return container
}

export async function uploadToAzure(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const container = getContainer()
  await _ensure
  const safe = `${Date.now().toString(36)}-${filename.replace(/[^a-z0-9.\-_]/gi, '_')}`
  const blob = container.getBlockBlobClient(safe)
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } })
  return blob.url
}

export async function uploadBytesToAzure(
  data: Buffer | Uint8Array,
  ext: string,
  contentType: string
): Promise<string> {
  const filename = `${Date.now().toString(36)}.${ext}`
  return uploadToAzure(Buffer.from(data), filename, contentType)
}
