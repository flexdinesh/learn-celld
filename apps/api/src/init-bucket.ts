import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? "http://minio:9000",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "celldlab", secretAccessKey: "celldlab-secret" },
});
try {
  await client.send(new HeadBucketCommand({ Bucket: "celld-lab" }));
  console.log("Bucket already exists");
} catch (error) {
  if (
    !(error instanceof Error) ||
    !("$metadata" in error) ||
    typeof error.$metadata !== "object" ||
    error.$metadata === null ||
    !("httpStatusCode" in error.$metadata) ||
    error.$metadata.httpStatusCode !== 404
  )
    throw error;
  await client.send(new CreateBucketCommand({ Bucket: "celld-lab" }));
  console.log("Created celld-lab bucket");
}
