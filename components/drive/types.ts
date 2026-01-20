export interface FileRecord {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
  name: string;
  file: string | string[]; // Can be string or array depending on PB setup
  size: number;
  owner: string;
  folder?: string;
  is_shared?: boolean;
  share_type?: string;
  expand?: any;
  short_id?: string;
}

export interface FolderRecord {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
  name: string;
  parent?: string;
  owner: string;
  is_shared?: boolean;
  share_type?: string;
}
