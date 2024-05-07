import * as bcrypt from 'bcrypt'

export function encodePassword(rawPassword: string) {
    const salt = bcrypt.genSaltSync();
    return bcrypt.hashSync(rawPassword, salt)
}

export function comparePasswords(rawPassword: string, hash: string){
    return bcrypt.compareSync(rawPassword, hash)
}

export function generateToken(): string {
    const min = 100000;
    const max = 999999;
    const token = Math.floor(Math.random() * (max - min + 1)) + min;
    return token.toString();
}