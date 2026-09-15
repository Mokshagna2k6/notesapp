export interface Folder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  scene: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}
