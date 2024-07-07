import { Prisma } from '@prisma/client';
import { isEmail } from 'class-validator';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as moment from 'moment-timezone';

const attendanceDefault = JSON.stringify({
  1: false,
  2: false,
  3: false,
  4: false,
  5: false,
  6: false,
  7: false,
  8: false,
  9: false,
  10: false,
  11: false,
  12: false,
  13: false,
  14: false,
  15: false,
  16: false,
  17: false,
  18: false,
  19: false,
  20: false,
  21: false,
  22: false,
  23: false,
  24: false,
  25: false,
  26: false,
  27: false,
  28: false,
  29: false,
  30: false,
  31: false,
});

@Injectable()
export class UserService {
  constructor(private prismaService: PrismaService) {}

  async userDetail(username: string): Promise<any> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: {
          username: username,
        },
        select: {
          userId: true,
          username: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
          description: true,
          item: true,
          rank: true,
          role: true,
        },
      });

      return {
        success: true,
        user: user,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async attendance({ userId }: { userId: number }): Promise<any> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: {
          userId: +userId,
        },
        select: {
          userId: true,
          attendance: true,
        },
      });

      return {
        success: true,
        attendance: user.attendance ? user.attendance : attendanceDefault,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async attendanceCheck({ userId }: { userId: number }): Promise<any> {
    const now = moment.tz('Asia/Ho_Chi_Minh');
    const getDay = now.date();
    const getMonth = now.month() + 1;
    const getYear = now.year();

    try {
      const isItem =
        getDay === 8 && getMonth === 5 && getYear === 2024 ? true : false;

      const user = await this.prismaService.user.findUnique({
        where: {
          userId: +userId,
        },
        select: {
          userId: true,
          item: true,
          attendance: true,
        },
      });

      // console.log(user)

      const checkAttendance = { ...JSON.parse( user?.attendance ? user.attendance : attendanceDefault ) };
      checkAttendance[`${getDay}`] = true;

      let where: Prisma.UserUpdateInput = {
        attendance: JSON.stringify(checkAttendance)
      };
      if(isItem) {
        where = {
          ...where,
          item: 1
        }
      }
      
      await this.prismaService.user.update({
        where: {
          userId: +userId,
        },
        data: where
      });

      return {
        success: true,
        isAttendance: getDay,
        item: isItem ? 1 : false,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async findById(userId: number) {
    return await this.prismaService.user.findUnique({
      where: {
        userId: userId,
      },
      include: {
        role: true,
      },
    });
  }

  async findByAccout(accout: string) {
    let where: Prisma.UserWhereUniqueInput;
    if (isEmail(accout)) {
      where = {
        email: accout,
      };
    } else {
      where = {
        username: accout,
      };
    }
    return await this.prismaService.user.findUnique({
      where: where,
      include: {
        role: true,
      },
    });
  }

  async findTopMembers() {
    const members = await this.prismaService.user.findMany({
      take: 5,
      where: {
        NOT: {
          role: {
            roleName: 'admin',
          },
        },
      },
      orderBy: {
        rank: 'desc',
      },
      select: {
        userId: true,
        username: true,
        avatarUrl: true,
        name: true,
        rank: true,
        item: true,
        role: {
          select: {
            roleName: true,
          },
        },
      },
    });
    return {
      success: true,
      members: members,
    };
  }

  async updateName({
    userId,
    name,
  }: {
    userId: number;
    name: string;
  }): Promise<any> {
    try {
      const user = await this.prismaService.user.update({
        where: {
          userId: userId,
        },
        data: {
          name: name,
        },
      });

      return {
        success: true,
        user: user,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  async updateAvatar({
    userId,
    avatar,
  }: {
    userId: number;
    avatar: string;
  }): Promise<any> {
    try {
      const user = await this.prismaService.user.update({
        where: {
          userId: userId,
        },
        data: {
          avatarUrl: avatar,
        },
      });

      return {
        success: true,
        user: user,
        // avatar: avatar
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }
}
