import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import * as moment from 'moment';
import * as CryptoJS from 'crypto-js';
import axios from 'axios';

const config = {
  app_id: '2554',
  key1: 'sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn',
  key2: 'trMrHtvjo6myautxDUiAcYsVtaeQ8nhf',
  endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
};

@Injectable()
export class PaymentService {
  async payment({ price }: { price: number }) {
    const embed_data = {
      //sau khi hoàn tất thanh toán sẽ đi vào link này (thường là link web thanh toán thành công của mình)
      redirecturl: 'http://localhost:3000/secure/payment/rank',
    };

    console.log("payment")

    const items = [];
    const transID = Math.floor(Math.random() * 1000000);

    const order = {
      app_id: config.app_id,
      // {moment().format('YYMMDD')}_${transID}
      app_trans_id: `${moment().format('YYMMDD')}_${transID}`, // translation missing: vi.docs.shared.sample_code.comments.app_trans_id
      app_user: 'user123',
      app_time: Date.now(), // miliseconds
      item: JSON.stringify(items),
      embed_data: JSON.stringify(embed_data),
      amount: price,
      //khi thanh toán xong, zalopay server sẽ POST đến url này để thông báo cho server của mình
      //Chú ý: cần dùng ngrok để public url thì Zalopay Server mới call đến được
      callback_url: 'https://b074-1-53-37-194.ngrok-free.app/callback',
      description: `MUA ĐIỂM THỨ HẠNG - TRUYENKK #${transID}`,
      bank_code: '',
      mac: null
    };

    // appid|app_trans_id|appuser|amount|apptime|embeddata|item
    const data =
      config.app_id +
      '|' +
      order.app_trans_id +
      '|' +
      order.app_user +
      '|' +
      order.amount +
      '|' +
      order.app_time +
      '|' +
      order.embed_data +
      '|' +
      order.item;
    order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

    console.log("endpoint: ", config.endpoint)
    console.log("order: ", order)

    try {
      const result = await axios.post(config.endpoint, null, { params: order });
      if(result.data === 2) {
        return {
          success: false,
          message: result.data
        }
      }
      console.log("result: ", result.data)

      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.log(error);
      return {
        success: false,
        message: error
      }
    }
  }

  async callback(req: Request, res: Response, body: Body) {
    let result = {
      return_code: null,
      return_message: null
    };

    return {
      success: true,
      message: "Tăng điểm thành công"
    }
    // try {
    //   let dataStr = body.data;
    //   let reqMac = body.mac;

    //   let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();
    //   console.log('mac =', mac);

    //   // kiểm tra callback hợp lệ (đến từ ZaloPay server)
    //   if (reqMac !== mac) {
    //     // callback không hợp lệ
    //     result.return_code = -1;
    //     result.return_message = 'mac not equal';
    //   } else {
    //     // thanh toán thành công
    //     // merchant cập nhật trạng thái cho đơn hàng ở đây
    //     let dataJson = JSON.parse(dataStr, config.key2);
    //     console.log(
    //       "update order's status = success where app_trans_id =",
    //       dataJson['app_trans_id'],
    //     );

    //     result.return_code = 1;
    //     result.return_message = 'success';
    //   }
    // } catch (ex) {
    //   console.log('lỗi:::' + ex.message);
    //   result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
    //   result.return_message = ex.message;
    // }

    // thông báo kết quả cho ZaloPay server
    // return result;
  }
}
