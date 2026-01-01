const mega = require("megajs");

const upload = (data, name) => {
    return new Promise((resolve, reject) => {
        // 1. පරිසර විචල්‍යයන් (Variables) පරීක්ෂාව
        const email = process.env.MEGA_EMAIL;
        const password = process.env.MEGA_PASSWORD;

        if (!email || !password) {
            return reject(new Error("MEGA_EMAIL හෝ MEGA_PASSWORD සකසා නැත. Render Secrets පරීක්ෂා කරන්න."));
        }

        // 2. Storage එක සාදා ready වන තෙක් බලා සිටීම
        const storage = new mega.Storage({
            email: email,
            password: password,
            keepalive: true
        }, (error) => {
            if (error) {
                return reject(new Error("MEGA Login එක අසාර්ථකයි: " + error.message));
            }

            // 3. Storage එක Ready වුණාම පමණක් upload එක ආරම්භ කිරීම
            const uploadStream = storage.upload({ name: name, allowUploadBuffering: true }, (err, file) => {
                if (err) {
                    storage.close();
                    return reject(err);
                }

                // 4. ෆයිල් එක අප්ලෝඩ් වුණාම ලින්ක් එක ලබාගැනීම
                file.link((linkErr, url) => {
                    storage.close();
                    if (linkErr) return reject(linkErr);
                    resolve(url);
                });
            });

            // Data එක Stream එකට Pipe කිරීම
            if (data.pipe) {
                data.pipe(uploadStream);
            } else {
                uploadStream.end(data);
            }

            // Error Handle කිරීම
            uploadStream.on('error', (uErr) => {
                storage.close();
                reject(uErr);
            });
        });
    });
};

module.exports = { upload };
