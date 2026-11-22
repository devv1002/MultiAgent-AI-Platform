import fs from "fs"
import path from "path"
import crypto from "crypto"
import multer from "multer"

const uploadDir=path.resolve("./temp")

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })          // file or images issi k andr dalegi jo bhi multer se aayegi
}

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadDir)
    },
    filename(req, file, cb) {
        const sanitized = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")
        const uniqueId = crypto.randomUUID()
        cb(null, `${Date.now()}-${uniqueId}-${sanitized}`)
    },
})

const fileFilter = (req, file, cb) => {
     if(file.mimetype=="application/pdf" ||
        file.mimetype.startsWith("image/")
      ){
        cb(null,true)
      }else{
        const err = new Error("Only PDF and Images are allowed.")
        err.status = 400
        cb(err, false)
      }
}

export const cleanupTempFile = (filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath)
        } catch (err) {
            console.error("Temporary file cleanup error:", err.message)
        }
    }
}

export default multer({
    storage, fileFilter, limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB limit for memory protection
    }
})