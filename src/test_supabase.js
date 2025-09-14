
const testData = {
    transcript: "Hey Sean! It was so nice meeting you today. Let's grab lunch sometime next week.",
    email: "gunosean@gmail.com",
    name: "Sean Guno",
    field: "Computer Science",
}

fetch('http://localhost:3000/api/voice', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(testData),
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));