const PocketBase = require('pocketbase/cjs');

async function updateSchema() {
    const pb = new PocketBase('https://monadb.snowman0919.site');
    
    try {
        await pb.admins.authWithPassword('cloud-worker01@monad.io.kr', 'm0WBlFC70-c4WFl');
        console.log('Admin authenticated');
        
        const collections = ['docs', 'forms'];
        
        for (const colName of collections) {
            const collection = await pb.collections.getOne(colName);
            
            // Update Schema
            const newFields = [
                { name: 'share_team', type: 'bool' },
                { name: 'tVersion', type: 'number' },
                { name: 'lastClientId', type: 'text' }
            ];

            for (const field of newFields) {
                if (!collection.fields.find(f => f.name === field.name)) {
                    console.log(`Adding ${field.name} to ${colName}...`);
                    collection.fields.push({
                        name: field.name,
                        type: field.type,
                        required: false,
                        options: {}
                    });
                }
            }

            // Update Rules
            collection.listRule = `author = @request.auth.id || is_shared = true || share_team = true`;
            collection.viewRule = `author = @request.auth.id || is_shared = true || share_team = true`;
            collection.updateRule = `author = @request.auth.id || (is_shared = true && share_type = "edit" && @request.auth.id != "")`;
            
            await pb.collections.update(collection.id, collection);
            console.log(`Updated rules and schema for ${colName}`);
        }
    } catch (err) {
        console.error('Error updating schema:', err);
        process.exit(1);
    }
}

updateSchema();
