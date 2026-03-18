import { useState, useCallback } from "react";
import type { LoadedFile } from "../types";

export function useFileManager() {
  const [files, setFiles] = useState<LoadedFile[]>([]);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: LoadedFile[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) continue;
      const buffer = await file.arrayBuffer();
      newFiles.push({ name: file.name, data: buffer });
    }

    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const unique = newFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...unique];
    });
  }, []);

  const removeFile = useCallback((fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  return { files, addFiles, removeFile, clearFiles };
}
