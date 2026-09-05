import {fetchData, postData} from './base';

async function login(username: string, password: string) {
    const response = await postData('/api/login', { username, password });
}

async function logout() {
    const response = await postData('/api/logout', {});
}