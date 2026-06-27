import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'

const ACCOUNT = 'avawhatsappstorage20487'
const CONTAINER = 'saarthi-media'
const KEY = process.env.AZURE_STORAGE_KEY!

function getContainer(): ContainerClient {
  const connStr = `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT};AccountKey=${KEY};EndpointSuffix=core.windows.net`
  return BlobServiceClient.fromConnectionString(connStr).getContainerClient(CONTAINER)
}

export async function uploadToAzure(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const container = getContainer()
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
