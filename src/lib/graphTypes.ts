export type Profile = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Board = {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export type Tag = {
  id: string
  user_id: string
  name: string
  normalized_name: string
  created_at: string
  updated_at: string
}

export type PersonNode = {
  id: string
  board_id: string
  owner_user_id: string
  name: string
  tag_id: string | null
  x: number
  y: number
  is_root: boolean
  created_at: string
  updated_at: string
}

export type PersonNote = {
  id: string
  person_id: string
  owner_user_id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

export type Connection = {
  id: string
  board_id: string
  owner_user_id: string
  person_a_id: string
  person_b_id: string
  created_at: string
}

export type BoardGraphPayload = {
  board: Board
  tags: Tag[]
  people: PersonNode[]
  notes: PersonNote[]
  connections: Connection[]
}
