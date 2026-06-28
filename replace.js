const fs = require('fs');
const path = require('path');

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (/\.(ts|tsx|css)$/.test(file)) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            content = content.replace(/SecureAI/g, 'Kkebi');
            content = content.replace(/Pagori/g, 'Kkebi');
            content = content.replace(/pagori/g, 'kkebi');
            // Re-apply the USD change to billing/page.tsx
            if (fullPath.includes('billing') && fullPath.includes('page.tsx')) {
                content = content.replace(/priceKrw/g, 'priceUsd');
                content = content.replace(/₩9,900/g, '$9');
                content = content.replace(/₩49,000/g, '$39');
                content = content.replace(/₩149,000/g, '$99');
                content = content.replace(/₩\{pack\.priceUsd\.toLocaleString\(\)\}/g, '${pack.priceUsd}');
            }

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDirectory('apps/frontend/src');

// Rename PagoriBrand.tsx to KkebiBrand.tsx
const oldPath = path.join('apps', 'frontend', 'src', 'components', 'brand', 'PagoriBrand.tsx');
const newPath = path.join('apps', 'frontend', 'src', 'components', 'brand', 'KkebiBrand.tsx');
if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log('Renamed PagoriBrand.tsx to KkebiBrand.tsx');
}
