import { type HashWorkerRequest, type HashWorkerResponse, hashFile } from "../utils/hash";

function reply(message: HashWorkerResponse): void {
  self.postMessage(message);
}

self.onmessage = async (event: MessageEvent<HashWorkerRequest>): Promise<void> => {
  const { id, file, algorithm } = event.data;
  try {
    const value = await hashFile(file, algorithm, (processed, total) => {
      reply({ id, type: "progress", processed, total });
    });
    reply({ id, type: "done", value });
  } catch (error) {
    reply({
      id,
      type: "error",
      message: error instanceof Error ? error.message : "Failed to calculate the file hash.",
    });
  }
};
