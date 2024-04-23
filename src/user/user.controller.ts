import {
  Body,
  Controller, Get, Param, Post, Put, Request, UseGuards
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtGuard } from '../auth/guard/jwt.guard';

@Controller('/api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // GET .../api/users/me
  // @UseGuards(MyJwtGuard)
  // @Get('me')
  // async me(@GetUser() user: User) {
  //   return user;
  // }

  @Post('/upload/avatar')
  uploadAvatar(@Param('username') username: string) {
    return this.userService.userDetail(username); 
  }

  @UseGuards(JwtGuard)
  @Put('/update/name')
  updateInfo(
    @Request() req,
    @Body('name') name: string,
  ) {
    return this.userService.updateName({ userId: req.user.userId, name: name }); 
  }

  @UseGuards(JwtGuard)
  @Get(':username')
  findOne(@Param('username') username: string) {
    return this.userService.userDetail(username); 
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
  //   return this.userService.update(+id, updateUserDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.userService.remove(+id);
  // }

  
}
