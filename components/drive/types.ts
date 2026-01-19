export type FileRecord = {
  id: string;
  collectionId: string;
  collectionName?: string;
  file: string[] | string;
  owner: string;
  share_type: 'none' | 'view' | 'edit';
  is_shared: boolean;
  short_id?: string;
  created: string;
  updated: string;
  name?: string;
  size?: number;
  folder?: string;
  tVersion?: number;
  expand?: {
    owner?: {
      name?: string;
      email?: string;
    }
  }
};

export type FolderRecord = {
  id: string;
  collectionId?: string;
  collectionName?: string;
  name: string;
  owner: string;
  parent: string;
  created: string;
  updated: string;
  tVersion?: number;
};
