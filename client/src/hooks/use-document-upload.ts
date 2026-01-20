import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface UploadedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileKey: string;
  fileSize: string | null;
  category: string | null;
}

interface UseDocumentUploadOptions {
  onSuccess?: (document: UploadedDocument) => void;
  onError?: (error: Error) => void;
}

export function useDocumentUpload(options: UseDocumentUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const uploadDocument = useCallback(
    async (
      file: File,
      solicitationId: string,
      category?: string
    ): Promise<UploadedDocument | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const urlRes = await apiRequest("POST", "/api/documents/request-upload-url", {
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          solicitationId,
          category,
        });
        const urlData = await urlRes.json();
        const { uploadURL, objectPath } = urlData;

        setProgress(30);
        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Falha no upload do arquivo");
        }

        setProgress(70);
        const saveRes = await apiRequest("POST", "/api/documents/save", {
          solicitationId,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileKey: objectPath,
          fileSize: file.size,
          category,
        });
        const document: UploadedDocument = await saveRes.json();

        setProgress(100);
        options.onSuccess?.(document);
        return document;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload falhou");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [options]
  );

  const uploadMultipleDocuments = useCallback(
    async (
      files: { file: File; category: string }[],
      solicitationId: string
    ): Promise<UploadedDocument[]> => {
      const results: UploadedDocument[] = [];
      
      for (const { file, category } of files) {
        const doc = await uploadDocument(file, solicitationId, category);
        if (doc) {
          results.push(doc);
        }
      }

      return results;
    },
    [uploadDocument]
  );

  return {
    uploadDocument,
    uploadMultipleDocuments,
    isUploading,
    progress,
    error,
  };
}
