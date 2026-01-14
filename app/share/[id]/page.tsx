import { notFound } from "next/navigation";
import pb from "@/lib/pocketbase";
import { Download, File, CloudOff } from "lucide-react";
import Link from "next/link";

type FileRecord = {
  id: string;
  collectionId: string;
  file: string[];
  share_type: 'none' | 'view' | 'edit';
  created: string;
};

// Next.js 15: params is async
export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let record: FileRecord | null = null;

  try {
    // 1. Try fetching by Record ID
    record = await pb.collection('cloud').getOne(id) as unknown as FileRecord;
  } catch (e) {
    // 2. Fallback: Try fetching by Short ID (Custom Slug)
    try {
      // Basic sanitization
      const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '');
      record = await pb.collection('cloud').getFirstListItem(`short_id="${safeId}"`) as unknown as FileRecord;
    } catch (inner) {
      // Not found
    }
  }

  // Security Check: If not shared, hide it. 
  // (In a real app, the DB rule should enforce this, but double check here)
  if (!record || record.share_type === 'none') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <CloudOff className="w-10 h-10 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">File not found or private</h1>
        <p className="text-slate-500 mb-8">The file you are looking for does not exist or has stopped being shared.</p>
        <Link href="/" className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
          Go Home
        </Link>
      </div>
    );
  }

  const fileUrl = `https://monadb.snowman0919.site/api/files/${record.collectionId}/${record.id}/${record.file[0]}`;
  const isImage = record.file[0]?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const fileName = record.file[0];

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-lg glass-panel p-8 rounded-[2rem] flex flex-col items-center">
        <div className="w-full aspect-video bg-slate-100 rounded-2xl mb-6 flex items-center justify-center overflow-hidden border border-slate-200">
          {isImage ? (
            <img src={fileUrl} alt={fileName} className="w-full h-full object-contain" />
          ) : (
            <File className="w-20 h-20 text-indigo-400" />
          )}
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-2 text-center break-all">{fileName}</h1>
        <p className="text-slate-500 text-sm mb-8">Shared via Monacle Cloud</p>

        <div className="flex gap-4 w-full">
          <a
            href={fileUrl}
            download={fileName.replace(/_[a-z0-9]+\.([^.]+)$/i, '.$1')}
            target="_blank"
            className="flex-1 bg-slate-900 hover:bg-black text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/10"
          >
            <Download className="w-4 h-4" /> Download
          </a>
          <Link
            href="/"
            className="px-6 h-12 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600 flex items-center justify-center transition-colors"
          >
            Monacle
          </Link>
        </div>
      </div>
    </div>
  )
}
