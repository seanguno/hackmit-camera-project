const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

async function testJsonbSchema() {
    try {
        console.log('🧪 Testing JSONB Schema with Mock Data')
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        
        if (!supabaseUrl || !supabaseKey) {
            console.log('❌ Missing Supabase environment variables')
            return
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        // Test data with multiple conversations
        const testData = {
            field: "Computer Science",
            email: "test@example.com",
            name: "Test User",
            history: "Hello, I'm working on a machine learning project at MIT. It's been really exciting so far!",
            summary: "Introduction conversation about ML project at MIT"
        }
        
        // Convert to JSONB format
        const historyJsonb = {
            conversations: [
                {
                    transcript: testData.history,
                    timestamp: new Date().toISOString(),
                    source: "voice_capture"
                }
            ]
        }

        const summaryJsonb = {
            summaries: [
                {
                    summary: testData.summary,
                    timestamp: new Date().toISOString(),
                    generated_by: "claude"
                }
            ]
        }

        console.log('📤 Inserting test data with JSONB schema...')
        console.log('History JSONB:', JSON.stringify(historyJsonb, null, 2))
        console.log('Summary JSONB:', JSON.stringify(summaryJsonb, null, 2))

        // Insert test record
        const { data: result, error } = await supabase
            .from('convo')
            .insert({
                field: testData.field,
                email: testData.email,
                name: testData.name,
                history: historyJsonb,
                summary: summaryJsonb
            })
            .select()
            .single()

        if (error) {
            console.log('❌ Error:', error.message)
            return
        }

        console.log('✅ Successfully inserted with JSONB schema!')
        console.log('📊 Result:', JSON.stringify(result, null, 2))

        // Now test appending another conversation
        console.log('\n🔄 Testing conversation appending...')
        
        const existingHistory = result.history
        const existingSummary = result.summary

        // Add new conversation
        existingHistory.conversations.push({
            transcript: "Update: The ML project is going great! We just finished the neural network training.",
            timestamp: new Date().toISOString(),
            source: "voice_capture"
        })

        // Add new summary
        existingSummary.summaries.push({
            summary: "Follow-up conversation about ML project progress",
            timestamp: new Date().toISOString(),
            generated_by: "claude"
        })

        // Update the record
        const { data: updatedResult, error: updateError } = await supabase
            .from('convo')
            .update({
                history: existingHistory,
                summary: existingSummary
            })
            .eq('id', result.id)
            .select()
            .single()

        if (updateError) {
            console.log('❌ Update Error:', updateError.message)
            return
        }

        console.log('✅ Successfully appended conversation!')
        console.log('📊 Updated Result:')
        console.log('Total conversations:', updatedResult.history.conversations.length)
        console.log('Total summaries:', updatedResult.summary.summaries.length)
        console.log('Latest conversation:', updatedResult.history.conversations[updatedResult.history.conversations.length - 1])
        
    } catch (error) {
        console.error('❌ Error:', error.message)
    }
}

testJsonbSchema()
