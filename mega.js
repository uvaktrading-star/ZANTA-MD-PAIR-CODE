const mega = require("megajs");

const upload = (data, name) => {
    return new Promise((resolve, reject) => {
        const email = process.env.MEGA_EMAIL;
        const password = process.env.MEGA_PASSWORD;

        if (!email || !password) {
            return reject(new Error("MEGA_EMAIL හෝ MEGA_PASSWORD සකසා නැත."));
        }

        // ලොගින් එකේදී ඇතිවන congestion එක මගහැරීමට options එකතු කිරීම
        const storage = new mega.Storage({
            email: email,
            password: password,
            keepalive: true,
            // සර්වර් එකෙන් response එක එනකම් තව ටිකක් වෙලාව ලබා දීම
            autologin: true 
        }, (error) => {
            if (error) {
                // EAGAIN error එක ආවොත් තත්පර 3ක් ඉඳලා ආයෙත් ට්‍රයි කරනවා (1 පාරක් පමණක්)
                console.log("MEGA Error: " + error.message + ". Retrying in 3s...");
                return setTimeout(() => {
                    // දෙවැනි උත්සාහය සඳහා storage එක නැවත සෑදීම වෙනුවට 
                    // reject එකක් දීලා pair.js එකෙන් handle කරන්න පුළුවන්.
                    return reject(new Error("MEGA Login එක අසාර්ථකයි: " + error.message));
                }, 3000);
            }

            const uploadStream = storage.upload({ name: name, allowUploadBuffering: true }, (err, file) => {
                if (err) {
                    storage.close();
                    return reject(err);
                }

                file.link((linkErr, url) => {
                    storage.close();
                    if (linkErr) return reject(linkErr);
                    resolve(url);
                });
            });

            if (data.pipe) {
                data.pipe(uploadStream);
            } else {
                uploadStream.end(data);
            }

            uploadStream.on('error', (uErr) => {
                storage.close();
                reject(uErr);
            });
        });
    });
};

module.exports = { upload };
