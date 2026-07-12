import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";

export async function extractTextWithTextract(buffer: Buffer): Promise<string> {
  const client = new TextractClient({
    region: process.env.AWS_REGION || "eu-west-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
  const response = await client.send(
    new DetectDocumentTextCommand({
      Document: { Bytes: buffer },
    }),
  );
  if (!response.Blocks) return "";
  return response.Blocks.filter((b) => b.BlockType === "LINE")
    .map((b) => b.Text)
    .join("\n");
}
