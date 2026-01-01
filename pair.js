const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");

// ෆයිල් සහ ෆෝල්ඩර් ඉවත් කිරීමේ function එක
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get("/", async (req, res) => {
    let num = req.query.number;

    // 1. අනිවාර්යයෙන්ම session ෆෝල්ඩර් එක තියෙනවාදැයි පරීක්ෂා කර සාදයි
    const sessionDir = path.join(__dirname, '../session');
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    async function RobinPair() {
        // Baileys Auth State
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        try {
            let RobinPairWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            // Pairing Code එක ලබාගැනීම
            if (!RobinPairWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, "");
                const code = await RobinPairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            RobinPairWeb.ev.on("creds.update", saveCreds);

            RobinPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    try {
                        await delay(5000); // creds.json එක හරියටම ලියවෙනකම් පොඩ්ඩක් ඉන්න
                        
                        const auth_path = path.join(sessionDir, "creds.json");
                        
                        // ෆයිල් එක තියෙනවාද කියා නැවත පරීක්ෂාව
                        if (!fs.existsSync(auth_path)) return;

                        // Mega Upload Logic
                        const randomId = Math.random().toString(36).substring(2, 8) + Math.floor(Math.random() * 1000);
                        
                        const mega_url = await upload(
                            fs.createReadStream(auth_path),
                            `${randomId}.json`
                        );

                        const string_session = mega_url.replace("https://mega.nz/file/", "");
                        const user_jid = jidNormalizedUser(RobinPairWeb.user.id);

                        const sid = `*ZANTA 💐 [The powerful WA BOT]*\n\n⚠️ ${string_session} ⚠️\n\n*This is your Session ID, copy this id and paste into config.js file*\n\n*https://wa.me/+94743404814?text=HEY_ZANTA💐🎭*`;
                        
                        // WhatsApp පණිවිඩ යැවීම
                        await RobinPairWeb.sendMessage(user_jid, {
                            image: { url: "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/alive-new.jpg?raw=true" },
                            caption: sid,
                        });

                        await RobinPairWeb.sendMessage(user_jid, { text: string_session });
                        await RobinPairWeb.sendMessage(user_jid, { text: `🛑 *Do not share this code to anyone* 🛑\n\n> *@akash kavindu*` });

                        console.log("Session uploaded and sent successfully!");

                        // වැඩේ ඉවර නිසා Cleanup කිරීම
                        await delay(2000);
                        removeFile(sessionDir);
                        // සර්වර් එක කෙලින්ම kill නොකර delay එකක් සහිතව process එක නවත්වන්න (විකල්පයි)
                        // process.exit(0); 

                    } catch (e) {
                        console.error("Error during connection open logic:", e);
                    }
                } 
                
                else if (connection === "close") {
                    let reason = lastDisconnect?.error?.output?.statusCode;
                    if (reason !== 401) {
                        await delay(5000);
                        RobinPair();
                    }
                }
            });

        } catch (err) {
            console.error("RobinPair error:", err);
            removeFile(sessionDir);
            if (!res.headersSent) {
                res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await RobinPair();
});

module.exports = router;
