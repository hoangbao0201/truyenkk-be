import { IsEmail, IsNotEmpty, IsString, Length } from "class-validator"


export class RegisterDTO {

    @IsString()
    @IsNotEmpty()
    @Length(4, 30, {
        message: "Tên phải có từ 4 đến 20 ký tự."
    })
    name: string

    @IsEmail()
    @IsNotEmpty()
    email: string
    
    @IsString()
    @IsNotEmpty()
    @Length(4, 20, {
        message: "Mật khẩu phải có từ 4 đến 20 ký tự."
    })
    password: string
} 

export class LoginDTO {
    @IsNotEmpty()
    @Length(5, 30, {
        // message: "Email từ 5 đến 30 kí tự"
    })
    accout: string
    
    @IsString()
    @IsNotEmpty()
    @Length(5, 30, {
        // message: "Password từ 5 đến 30 kí tự"
    })
    password: string
} 