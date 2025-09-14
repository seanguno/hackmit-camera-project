export interface Convo {
    id: number
    created_at: string
    field: string | null
    email: string | null
    name: string | null
    history: string | null
    summary: string | null
  }
  
  export interface Database {
    public: {
      Tables: {
        convo: {
          Row: Convo
          Insert: Omit<Convo, 'id' | 'created_at'>
          Update: Partial<Omit<Convo, 'id' | 'created_at'>>
        }
      }
    }
  }