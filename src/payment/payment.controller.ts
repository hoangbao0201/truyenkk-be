import { Controller, Get, Post, Body, Patch, Param, Delete, Request, Response, Query, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('/api/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(JwtGuard)
  @Post("/")
  payment(
    @Query('price') price?: string,
  ) {
    return this.paymentService.payment({ price: +price });
  }

  @UseGuards(JwtGuard)
  @Post("/callback")
  callback(@Request() req, @Response() res, @Body() body) {
    return this.paymentService.callback(req, res, body);
  }
}
