#!/usr/bin/env node

/**
 * Simple test script to debug conversation system
 * Run this after starting the MentraOS app to test conversation endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testConversationEndpoints() {
  console.log('🧪 Testing Conversation System...\n');

  try {
    // Test 1: Check conversation status
    console.log('1️⃣ Testing conversation status...');
    try {
      const statusResponse = await axios.get(`${BASE_URL}/api/conversation/status`);
      console.log('✅ Status Response:', JSON.stringify(statusResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Status Error:', error.response?.data || error.message);
    }

    // Test 2: Get all conversations
    console.log('\n2️⃣ Testing get all conversations...');
    try {
      const conversationsResponse = await axios.get(`${BASE_URL}/api/conversations`);
      console.log('✅ Conversations Response:', JSON.stringify(conversationsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Conversations Error:', error.response?.data || error.message);
    }

    // Test 3: Test manual save
    console.log('\n3️⃣ Testing manual conversation save...');
    try {
      const saveResponse = await axios.post(`${BASE_URL}/api/conversation/test-save`);
      console.log('✅ Save Response:', JSON.stringify(saveResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Save Error:', error.response?.data || error.message);
    }

    // Test 4: Check if conversations.json exists
    console.log('\n4️⃣ Checking conversation storage...');
    const fs = require('fs');
    const path = require('path');
    const conversationsFile = path.join(__dirname, 'storage', 'conversations', 'conversations.json');
    
    if (fs.existsSync(conversationsFile)) {
      const content = fs.readFileSync(conversationsFile, 'utf8');
      console.log('✅ Conversations file exists!');
      console.log('📄 Content:', content);
    } else {
      console.log('❌ Conversations file does not exist at:', conversationsFile);
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run the tests
testConversationEndpoints();
