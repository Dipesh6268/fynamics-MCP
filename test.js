const url = 'http://localhost:3000/memory';
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': 'team123secret'
};

async function runTests() {
  try {
    console.log('1. Testing POST /memory ...');
    const postRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        topic: 'Test Topic ' + Date.now(),
        content: 'This is a test memory for the team.',
        saved_by: 'Test Bot',
        tags: ['test', 'api']
      })
    });
    const postData = await postRes.json();
    console.log('POST Response:', postData);
    if (!postRes.ok) throw new Error(postData.error || 'POST failed');
    const memoryId = postData.id;

    console.log('\n2. Testing GET /memory/recent ...');
    const recentRes = await fetch(url + '/recent', { headers });
    const recentData = await recentRes.json();
    console.log(`Recent memories count: ${recentData.length}`);
    if (!recentRes.ok) throw new Error(recentData.error || 'GET recent failed');

    console.log('\n3. Testing GET /memory/search?q=test ...');
    const searchRes = await fetch(url + '/search?q=test', { headers });
    const searchData = await searchRes.json();
    console.log(`Search results count: ${searchData.length}`);
    if (!searchRes.ok) throw new Error(searchData.error || 'GET search failed');

    console.log('\n4. Testing DELETE /memory/:id ...');
    const deleteRes = await fetch(`${url}/${memoryId}`, { method: 'DELETE', headers });
    const deleteData = await deleteRes.json();
    console.log('DELETE Response:', deleteData);
    if (!deleteRes.ok) throw new Error(deleteData.error || 'DELETE failed');

    console.log('\nAll 4 endpoints tested successfully!');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

runTests();
