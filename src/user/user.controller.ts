import {
  Body,
  Controller, Get, Param, Post, Put, Request, UseGuards
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtGuard } from '../auth/guard/jwt.guard';

@Controller('/api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // GET .../api/users/top
  @Get('/top')
  async findTopMembers() {
    return this.userService.findTopMembers(); 
  }

  // @Post('/upload/avatar')
  // uploadAvatar(@Param('username') username: string) {
  //   return this.userService.userDetail(username); 
  // }

  @UseGuards(JwtGuard)
  @Put('/update/name')
  updateInfo(
    @Request() req,
    @Body('name') name: string,
  ) {
    return this.userService.updateName({ userId: req.user.userId, name: name }); 
  }

  @UseGuards(JwtGuard)
  @Put('/update/avatar')
  updateAvatar(
    @Request() req,
    @Body('avatar') avatar: string,
  ) {
    return this.userService.updateAvatar({ userId: req.user.userId, avatar: avatar }); 
  }

  @UseGuards(JwtGuard)
  @Get('/attendance')
  attendance(@Request() req) {
    return this.userService.attendance({ userId: +req.user.userId }); 
  }

  @UseGuards(JwtGuard)
  @Post('/attendance')
  attendanceCheck(@Request() req) {
    return this.userService.attendanceCheck({ userId: +req.user.userId }); 
  }

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
