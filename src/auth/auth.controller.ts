import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDTO, RegisterDTO } from './dto/auth.dto';
import { RefreshJwtGuard } from './guard/refresh.guard';
import { Body, Controller, Get, Post, Req, Request, Res, UseGuards } from '@nestjs/common';
import { JwtGuard } from './guard/jwt.guard';

@Controller('/api/auth')
export class AuthController {
    constructor(private authService : AuthService) {}

    // POST .../auth/register
    @Post('/register')
    register(@Body() body: RegisterDTO) {
        return this.authService.register(body);
    }

    // POST .../auth/login
    @Post('/login')
    login(@Body() body: LoginDTO) {
        return this.authService.login(body);
    }

    // POST .../auth/login
    @UseGuards(JwtGuard)
    @Post('/login/token')
    loginWithToken(
        @Request() req
    ) {
        return this.authService.loginWithToken(+req.user.userId);
    }

    // POST .../auth/refresh
    @UseGuards(RefreshJwtGuard)
    @Post('/refresh')
    refreshToken(@Request() req) {
        return this.authService.refreshToken(req.user);
    }

    // GET .../api/auth/google
    @Get('/google')
    @UseGuards(AuthGuard('google'))
    google(@Request() req) {}

    // GET .../api/auth/google/callback
    @Get('/google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthCallback(@Req() req, @Res() res: Response) {
        return this.authService.callbackGoogle(req, res);
    }
}
