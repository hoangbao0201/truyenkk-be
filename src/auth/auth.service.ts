import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as argon from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDTO, RegisterDTO } from './dto/auth.dto';

const EXPIRE_TIME = 60*24 * 1000;


@Injectable()
export class AuthService {
    constructor(
        private prismaService: PrismaService,
        private configService: ConfigService,
        private jwtService: JwtService,
        private userService: UserService,
    ) {}

    async register(authDTO: RegisterDTO) {
        try {
            const hashPassword = await argon.hash(authDTO.password);

            const user = await this.prismaService.user.create({
                data: {
                    name: authDTO.name,
                    username: authDTO.email.split("@")[0],
                    email: authDTO.email,
                    password: hashPassword,
                    role: {
                      connect: {
                        roleName: "guest"
                      }
                    }
                },
                select: {
                    name: true,
                    email: true,
                    username: true,
                    createdAt: true,
                    updatedAt: true,
                    password: false,
                },
            });

            return {
                success: true,
                message: `Regiter user successfully`,
                users: user,
            };
        } catch (error) {
            if (error.code === 'P2002') {
                // throw new ForbiddenException(error.message);
                // throw new ForbiddenException("Error in credentials");
                return {
                    success: false,
                    message: 'Email đã tồn tại',
                };
            }
            return {
                success: false,
                error: error,
            };
        }
    }

    async login(authDTO: LoginDTO) {
        try {
            const user = await this.validateUser(authDTO);
            if(!user) {
                // return {
                //     success: false,
                //     message: "Tài khoản hoặc mật khẩu không đúng"
                // }
                throw new UnauthorizedException();
            }
            const payload = {
                userId: user.userId,
                username: user.username,
                role: {
                    name: user?.role.roleName
                }
            };

            return {
                success: true,
                data: {
                    user,
                    backendTokens: {
                        accessToken: await this.jwtService.signAsync(payload, {
                            expiresIn: '1h',
                            secret: this.configService.get('TOKEN_SETCRET'),
                        }),
                        refreshToken: await this.jwtService.signAsync(payload, {
                            expiresIn: '7d',
                            secret: this.configService.get('REFRESH_TOKEN_SETCRET'),
                        }),
                        expiresIn: new Date().setTime(new Date().getTime() + EXPIRE_TIME),
                    },
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error,
            };
        }
    }

    async loginWithToken(userId: number) {
        try {
            const user = await this.userService.findById(+userId);
            if(!user) {
                throw new UnauthorizedException();
            }
            const payload = {
                userId: user.userId,
                username: user.username,
                role: {
                    name: user?.role.roleName
                }
            };

            return {
                success: true,
                data: {
                    user,
                    backendTokens: {
                        accessToken: await this.jwtService.signAsync(payload, {
                            expiresIn: '1h',
                            secret: this.configService.get('TOKEN_SETCRET'),
                        }),
                        refreshToken: await this.jwtService.signAsync(payload, {
                            expiresIn: '7d',
                            secret: this.configService.get('REFRESH_TOKEN_SETCRET'),
                        }),
                        expiresIn: new Date().setTime(new Date().getTime() + EXPIRE_TIME),
                    },
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error,
            };
        }
    }

    // async callbackGithub(req) {
    //     try {
    //         if (!req.user) {
    //             throw new Error();
    //         }
    //         const user = await this.validateUserBySocial("hoangbao020103");
    //         const payload = {
    //             userId: user.userId,
    //             username: user.username
    //         };

    //         return {
    //             user,
    //             // reqUser: req.user,
    //             backendTokens: {
    //                 accessToken: await this.jwtService.signAsync(payload, {
    //                     expiresIn: '1h',
    //                     secret: this.configService.get('TOKEN_SETCRET'),
    //                 }),
    //                 refreshToken: await this.jwtService.signAsync(payload, {
    //                     expiresIn: '7d',
    //                     secret: this.configService.get('REFRESH_TOKEN_SETCRET'),
    //                 }),
    //                 expiresIn: new Date().setTime(new Date().getTime() + EXPIRE_TIME),
    //             },
    //         };
    //     } catch (error) {
    //         return {
    //             success: false,
    //             error: error,
    //         };
    //     }
    // }

    // async callbackFacebook(req) {
    //     try {
    //         if (!req.user) {
    //             throw new Error();
    //         }
    //         const user = await this.validateUserBySocial("hoangbao020103");
    //         const payload = {
    //             userId: user.userId,
    //             username: user.username
    //         };
            
    //         return {
    //             user,
    //             // reqUser: req.user,
    //             backendTokens: {
    //                 accessToken: await this.jwtService.signAsync(payload, {
    //                     expiresIn: '1h',
    //                     secret: this.configService.get('TOKEN_SETCRET'),
    //                 }),
    //                 refreshToken: await this.jwtService.signAsync(payload, {
    //                     expiresIn: '7d',
    //                     secret: this.configService.get('REFRESH_TOKEN_SETCRET'),
    //                 }),
    //                 expiresIn: new Date().setTime(new Date().getTime() + EXPIRE_TIME),
    //             },
    //         };
    //     } catch (error) {
    //         return {
    //             success: false,
    //             error: error,
    //         };
    //     }
    // }

    async callbackGoogle(req, res) {
        const urlFe = this.configService.get('NODE_ENV') === "production" ? "https://truyenkk.vercel.app" : "http://localhost:3000"
        try {
            if (!req.user) {
                throw new Error();
            }
            const email = req.user.email;
            console.log("email: ", email);

            const user = await this.userService.findByAccout(email);

            let payload;
            if(!user) {
                // res.redirect(`http://localhost:3000/secure-login`);
                const createUserRes = await this.prismaService.user.create({
                    data: {
                        name: email.split("@")[0],
                        username: email.split("@")[0],
                        email: email,
                        password: null,
                        role: {
                          connect: {
                            roleName: "guest"
                          }
                        }
                    },
                    select: {
                        userId: true,
                        name: true,
                        email: true,
                        username: true,
                        createdAt: true,
                        updatedAt: true,
                        password: false,
                    },
                });

                payload = {
                    userId: createUserRes.userId,
                    username: createUserRes.username,
                    role: {
                        name: "guest"
                    },
                };
            }
            else {
                payload = {
                    userId: user.userId,
                    username: user.username,
                    role: {
                        name: user?.role.roleName
                    },
                };
            }
            console.log("user: ", user);
            
            const token = await this.jwtService.signAsync(payload, {
                expiresIn: '1m',
                secret: this.configService.get('TOKEN_SETCRET'),
            });

            // console.log("token: ", token);
            
            res.redirect(`${urlFe}/auth/login?token=${token}`);
        } catch (error) {
            res.redirect(`${urlFe}/auth/login?type=ERROR_LOGIN_GOOGLE`);
        }
    }


    async validateUser(dto: LoginDTO) {
        const user = await this.userService.findByAccout(dto.accout);

        const checkPassword = await argon.verify(
            user.password,
            dto.password,
        );
        if (user && checkPassword) {
            delete user.password;
            return user;
        }
        throw new UnauthorizedException();
    }

    async validateUserBySocial(accout: string) {
        const user = await this.userService.findByAccout(accout);

        if (user) {
            // delete user.password;
            return user;
        }
        throw new UnauthorizedException();
    }

    async refreshToken(user: { userId: number, username: string, role: { name: string } }) {
        const payload = {
            userId: user.userId,
            username: user.username,
            role: {
                name: user?.role.name
            }
        };

        return {
            success: true,
            accessToken: await this.jwtService.signAsync(payload, {
                expiresIn: '1h',
                secret: this.configService.get('TOKEN_SETCRET'),
            }),
            refreshToken: await this.jwtService.signAsync(payload, {
                expiresIn: '7d',
                secret: this.configService.get('REFRESH_TOKEN_SETCRET'),
            }),
            expiresIn: new Date().setTime(new Date().getTime() + EXPIRE_TIME),
        };
    }
}
