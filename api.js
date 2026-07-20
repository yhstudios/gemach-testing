const REPO_OWNER = 'yhstudios'; // <--- CHANGE THIS TO YOUR GITHUB USERNAME
const REPO_NAME = 'gemach-db';             // <--- CHANGE THIS IF YOU NAMED THE REPO DIFFERENTLY
const PAT1 = 'ghp_47FealsOaGV5r3';
const PAT2 = 'tlWfK9N4boW22ZKG2m1v1f';
const PAT = PAT1 + PAT2;
const FILE_PATH = 'data.json';

const Api = {
    dataSha: null,

    async fetchGistData() {
        try {
            const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
                headers: {
                    'Authorization': `Bearer ${PAT}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (res.status === 404) return null;

            const data = await res.json();
            this.dataSha = data.sha;

            const content = decodeURIComponent(escape(atob(data.content)));
            return JSON.parse(content);
        } catch (error) {
            console.error("Error fetching data:", error);
            return null;
        }
    },

    async saveGistData(appState) {
        try {
            const contentStr = JSON.stringify(appState, null, 2);
            const base64Content = btoa(unescape(encodeURIComponent(contentStr)));

            const body = {
                message: "Update database",
                content: base64Content
            };
            if (this.dataSha) body.sha = this.dataSha;

            const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${PAT}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error("Failed to save JSON");

            const data = await res.json();
            this.dataSha = data.content.sha;
            return true;
        } catch (error) {
            console.error("Error saving data to Gist:", error);
            return false;
        }
    },

    async uploadImage(gownId, base64DataUrl) {
        try {
            const base64Content = base64DataUrl.split(',')[1];
            let sha = null;
            const checkRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/images/${gownId}.jpg`, {
                headers: { 'Authorization': `Bearer ${PAT}` }
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                sha = checkData.sha;
            }
            const body = { message: `Upload image for ${gownId}`, content: base64Content };
            if (sha) body.sha = sha;
            await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/images/${gownId}.jpg`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return true;
        } catch (e) {
            console.error("Image upload failed:", e);
            return false;
        }
    },

    async fetchImage(gownId) {
        try {
            const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/images/${gownId}.jpg`, {
                headers: { 'Authorization': `Bearer ${PAT}` }
            });
            if (!res.ok) return null;
            const data = await res.json();
            return `data:image/jpeg;base64,${data.content.replace(/\n/g, '')}`;
        } catch (e) {
            return null;
        }
    }
};
