import type { LoadedFile } from "../types";

interface Props {
  files: LoadedFile[];
  onRemove: (fileName: string) => void;
  onClear: () => void;
}

export function FileList({ files, onRemove, onClear }: Props) {
  if (files.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          已加载 {files.length} 个文件
        </span>
        <button
          onClick={onClear}
          className="text-xs text-red-500 hover:text-red-700 transition-colors"
        >
          清除全部
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <span
            key={file.name}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
          >
            {file.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(file.name);
              }}
              className="ml-1 text-blue-500 hover:text-blue-700 font-bold"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
