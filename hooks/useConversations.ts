import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { Convo } from '../types/database'

export function useConversations(email: string) {
  const [conversations, setConversations] = useState<Convo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!email) return

    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from('convo')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching conversations:', error)
      } else {
        setConversations(data || [])
      }
      setLoading(false)
    }

    fetchConversations()
  }, [email])

  return { conversations, loading }
}