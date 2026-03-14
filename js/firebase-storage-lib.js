
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { app, showToast } from "./firebase-lib.js";

const storage = getStorage(app);

/**
 * Uploads a file to Firebase Storage and returns the public URL.
 * @param {File} file - The file to upload
 * @param {string} path - The path in storage (e.g. 'products/my-product/image1.jpg')
 * @param {function} onProgress - Callback for upload progress (0-100)
 * @returns {Promise<string>} - The download URL
 */
export async function uploadFile(file, path, onProgress = null) {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) onProgress(progress);
                console.log('Upload is ' + progress + '% done');
            }, 
            (error) => {
                console.error("Storage Error:", error);
                showToast("Erro ao fazer upload da imagem. Verifique o tamanho e tente novamente.", "error", 5000, "📸");
                reject(error);
            }, 
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    resolve(downloadURL);
                });
            }
        );
    });
}
