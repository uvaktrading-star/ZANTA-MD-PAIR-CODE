const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
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

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get("/", async (req, res) => {
  let num = req.query.number;
  if (!num) return res.send({ error: "Number is required" });

  async function RobinPair() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    
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
            await delay(5000); // පොඩි වෙලාවක් ඉන්න creds save වෙනකම්
            
            const auth_path = "./session/creds.json";
            if (!fs.existsSync(auth_path)) {
                console.log("Creds file not found yet...");
                return;
            }

            // 📤 Mega Upload ආරම්භය
            console.log("Uploading to Mega...");
            const mega_url = await upload(
              fs.createReadStream(auth_path),
              `ZANTA_${Math.floor(Math.random() * 10000)}.json`
            );

            const string_session = mega_url.replace("https://mega.nz/file/", "");

            const user_jid = jidNormalizedUser(RobinPairWeb.user.id);
            const sid = `*ZANTA 💐 [The powerful WA BOT]*\n\n⚠️ ${string_session} ⚠️\n\n*This is your Session ID*`;
            
            // 📩 පණිවිඩ යැවීම
            await RobinPairWeb.sendMessage(user_jid, {
              image: { url: "https://github.com/Akashkavindu/ZANTA_MD/blob/main/images/alive-new.jpg?raw=true" },
              caption: sid,
            });
            
            await RobinPairWeb.sendMessage(user_jid, { text: string_session });
            
            console.log("Session sent successfully!");

            // 🧹 Cleanup
            await delay(2000);
            removeFile("./session");
            // 🛑 වැදගත්: ඔක්කොම ඉවර වුණාම පමණක් රීස්ටාර්ට් කරන්න
            // exec("pm2 restart Robin"); 

          } catch (e) {
            console.log("Error in connection open: ", e);
          }
        } 
        
        if (connection === "close") {
          let reason = lastDisconnect?.error?.output?.statusCode;
          if (reason !== 401) {
             RobinPair();
          }
        }
      });
    } catch (err) {
      console.log("Main Error: ", err);
      removeFile("./session");
    }
  }
  return await RobinPair();
});

module.exports = router;
