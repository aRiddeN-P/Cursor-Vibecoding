/**
 * swaggerConfig.js
 * Base OpenAPI paths (Persian) for Dakhlyar.
 * Built specs: GET /api/docs/{fa|en}/{app|admin}
 */

const swaggerJsdoc = require('swagger-jsdoc');

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'دخلیار — مستندات API',
    description: 'مستندات کامل API اپلیکیشن مدیریت مالی شخصی دخلیار',
    version: '1.0.0',
    contact: {
      name: 'تیم دخلیار',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'سرور توسعه',
    },
  ],
  tags: [
    {
      name: 'احراز هویت',
      description: 'مسیرهای مربوط به ورود، ثبت‌نام، تایید ایمیل و بازیابی رمز عبور',
    },
    {
      name: 'استوری‌ها',
      description: 'استوری‌های آنبوردینگ (معرفی اپلیکیشن) برای کاربران تازه',
    },
    {
      name: 'مدیریت استوری‌ها (ادمین)',
      description: 'مسیرهای ادمین برای آپلود، ویرایش، حذف و ریست استوری‌ها (نیازمند session ادمین)',
    },
    {
      name: 'پروفایل',
      description: 'دریافت/ویرایش اطلاعات کاربر، تغییر رمز عبور، دستگاه‌های متصل و کد دعوت',
    },
    {
      name: 'سطح احراز هویت',
      description: 'وضعیت سطح احراز هویت کاربر و درخواست ارتقاء به سطح بالاتر',
    },
    {
      name: 'اشتراک',
      description: 'پلن‌های اشتراک، وضعیت اشتراک فعلی و ثبت درخواست خرید اشتراک',
    },
    {
      name: 'دستگاه‌ها',
      description: 'مشاهده و حذف دستگاه‌های متصل به حساب کاربری',
    },
    {
      name: 'پیام‌ها',
      description: 'صندوق پیام کاربر — دریافت، علامت خوانده‌شده، حذف و نمایش زمان نسبی فارسی',
    },
    {
      name: 'مدیریت احراز و اشتراک (ادمین)',
      description: 'مسیرهای ادمین برای بازبینی، تایید یا رد درخواست‌های احراز هویت و اشتراک (Dev mode)',
    },
    { name: 'پیام‌رسانی ادمین', description: 'ارسال پیام گروهی/مستقیم، تاریخچه و آمار پیام‌رسانی از پنل ادمین' },
    {
      name: 'آواتار',
      description: 'لیست آواتارهای رایگان/ویژه (DiceBear Personas)، انتخاب seed، آپلود/حذف عکس شخصی',
    },
    {
      name: 'سیستم دعوت',
      description: 'کد دعوت کاربران، اعتبارسنجی، اعمال کد در ثبت‌نام، تخفیف‌های فعال و لیست دعوت‌شدگان',
    },
    {
      name: 'سیستم دعوت (ادمین)',
      description: 'مسیرهای ادمین برای مشاهده روابط دعوت و آمار کلی سیستم دعوت',
    },
    {
      name: 'پوش نوتیفیکیشن',
      description: 'پوش نوتیفیکیشن وب (Web Push) — کلید عمومی VAPID و مدیریت subscription مرورگر',
    },
    {
      name: 'دسته‌بندی‌ها',
      description: 'دسته‌بندی‌های پیش‌فرض + دسته‌های سفارشی کاربر و درخواست افزودن دسته‌ی جدید',
    },
    {
      name: 'مدیریت دسته‌بندی‌ها (ادمین)',
      description: 'بازبینی، تایید یا رد درخواست‌های دسته‌بندی کاربران (Dev mode)',
    },
    {
      name: 'تراکنش‌ها',
      description: 'مدیریت تراکنش‌های درآمد و هزینه — ثبت، ویرایش، حذف، فیلتر، خلاصه ماهانه، تگ‌ها، تراکنش‌های تکراری و وارد کردن CSV',
    },
    { name: 'بودجه', description: 'تنظیم بودجه ماهانه، بودجه‌ریزی صفرمحور (ZBB) و کپی از ماه قبل' },
    { name: 'گزارشات', description: 'گزارش ماهانه، مقایسه، الگوی هفتگی، پیش‌بینی جریان نقدی و ردیابی اشتراک' },
    { name: 'امتیاز مالی', description: 'امتیاز مالی ماهانه ۰–۱۰۰ با جزئیات، تاریخچه و پیشنهاد بهبود' },
    { name: 'بینش‌های رفتاری', description: 'تحلیل الگوی خرج، نرخ پس‌انداز، اشتراک‌ها، بودجه و streak ثبت تراکنش' },
    { name: 'صادرکردن', description: 'خروجی CSV و PDF گزارش‌ها' },
    { name: 'اهداف پس‌انداز', description: 'تعریف اهداف مالی، واریز/برداشت و پیگیری پیشرفت' },
    { name: 'نمای بازار', description: 'قیمت لحظه‌ای طلا، ارز، رمزارز و کامودیتی از BrsApi.ir' },
    { name: 'دارایی‌ها', description: 'ثبت و ارزش‌گذاری دارایی‌های شخصی (طلایی، ارزی، ملک، …) — نیازمند اشتراک فعال' },
    { name: 'پیشنهاد تخصصی', description: 'پیشنهادات مالی تخصصی با پیگیری وضعیت — نیازمند اشتراک فعال' },
    { name: 'مدیریت پیشنهادات (ادمین)', description: 'ایجاد، ویرایش و حذف پیشنهادات تخصصی + ارسال push و پیام درون‌برنامه' },
    { name: 'دنگ و دونگ', description: 'مینی‌اپ دنگ و دونگ — تقسیم هزینه گروهی، محاسبه بدهی، تسویه و لینک عمومی' },
    { name: 'بنرهای تبلیغاتی', description: 'بنرهای چرخشی داشبورد — نمایش، کلیک و carousel' },
    { name: 'مدیریت بنرها (ادمین)', description: 'آپلود، ویرایش، حذف و آمار بنرهای تبلیغاتی' },
    {
      name: 'احراز هویت ادمین',
      description: 'ورود، خروج، تغییر رمز و مدیریت session پنل ادمین (کوکی جداگانه dakhlyar_admin_sid)',
    },
    {
      name: 'مدیریت مدیران (ادمین)',
      description: 'افزودن، ویرایش و حذف حساب‌های مدیر — فقط سوپر ادمین',
    },
    {
      name: 'آمار و داشبورد ادمین',
      description: 'آمار کلی، رشد کاربران، درآمد اشتراک، دسته‌بندی‌ها و لاگ فعالیت',
    },
    {
      name: 'مدیریت کاربران (ادمین)',
      description: 'لیست و جستجوی کاربران، جزئیات پروفایل، تایید/رد احراز و اشتراک',
    },
  ],
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'پیام خطا به زبان فارسی',
            example: 'خطای سرور',
          },
        },
      },
    },
  },
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['احراز هویت'],
        summary: 'ورود کاربر',
        description:
          'ورود کاربر با شماره موبایل و رمز عبور. در صورت ۳ تلاش ناموفق در ۱۰ دقیقه، حساب به مدت ۱۰ دقیقه قفل می‌شود.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mobile', 'password'],
                properties: {
                  mobile: {
                    type: 'string',
                    description: 'شماره موبایل کاربر (فرمت: 09xxxxxxxxx)',
                    example: '09121234567',
                  },
                  password: {
                    type: 'string',
                    description: 'رمز عبور کاربر',
                    example: 'MyPass@123',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'ورود موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', example: 1 },
                        mobile: { type: 'string', example: '09121234567' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'رمز عبور اشتباه است (شماره موبایل وجود دارد)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'رمز عبور اشتباه است',
                    },
                    attempts_left: { type: 'integer', example: 2 },
                  },
                },
              },
            },
          },
          404: {
            description: 'حسابی با این شماره موبایل ثبت نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'حسابی با این شماره موبایل ثبت نشده است' },
              },
            },
          },
          422: {
            description: 'فرمت ورودی نامعتبر',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'فرمت شماره موبایل معتبر نیست',
                    },
                  },
                },
              },
            },
          },
          423: {
            description: 'حساب کاربری قفل شده است',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    locked: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'حساب شما به مدت ۱۰ دقیقه قفل شده است',
                    },
                    remaining_seconds: { type: 'integer', example: 480 },
                  },
                },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/auth/check-duplicates': {
      post: {
        tags: ['احراز هویت'],
        summary: 'بررسی تکراری بودن اطلاعات',
        description:
          'بررسی این که شماره موبایل، ایمیل یا کد ملی قبلاً در سامانه ثبت شده‌اند یا خیر. در زمان پر کردن فرم ثبت‌نام به صورت on-blur فراخوانی می‌شود.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  mobile: {
                    type: 'string',
                    description: 'شماره موبایل برای بررسی تکراری بودن',
                    example: '09121234567',
                  },
                  email: {
                    type: 'string',
                    description: 'ایمیل برای بررسی تکراری بودن',
                    example: 'user@example.com',
                  },
                  national_id: {
                    type: 'string',
                    description: 'کد ملی برای بررسی تکراری بودن',
                    example: '0012345678',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'نتیجه بررسی تکراری بودن',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    mobile_taken: { type: 'boolean', example: false },
                    email_taken: { type: 'boolean', example: true },
                    national_id_taken: { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/auth/send-otp': {
      post: {
        tags: ['احراز هویت'],
        summary: 'ارسال کد تایید به ایمیل',
        description:
          'یک کد ۶ رقمی تصادفی تولید کرده و به ایمیل کاربر ارسال می‌کند. کد به مدت ۱۸۰ ثانیه معتبر است. کدهای قبلی این کاربر برای همین نوع به صورت خودکار باطل می‌شوند.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'type'],
                properties: {
                  email: {
                    type: 'string',
                    description: 'آدرس ایمیل گیرنده',
                    example: 'user@example.com',
                  },
                  type: {
                    type: 'string',
                    enum: ['signup', 'reset_password'],
                    description: 'نوع OTP — مقدار مجاز: signup یا reset_password',
                    example: 'signup',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'ارسال موفق کد',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'کد تایید به ایمیل شما ارسال شد',
                    },
                  },
                },
              },
            },
          },
          404: {
            description: 'حساب کاربری با این ایمیل پیدا نشد (فقط برای reset_password)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'حسابی با این ایمیل یافت نشد' },
              },
            },
          },
          422: {
            description: 'فرمت ایمیل نامعتبر',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'آدرس ایمیل معتبر نیست' },
              },
            },
          },
          500: {
            description: 'خطای ارسال ایمیل',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور — ارسال ایمیل با مشکل مواجه شد' },
              },
            },
          },
        },
      },
    },

    '/api/auth/verify-otp': {
      post: {
        tags: ['احراز هویت'],
        summary: 'تایید کد OTP',
        description:
          'کد ۶ رقمی ارسال شده به ایمیل را بررسی می‌کند. در صورت موفقیت، session فلگ otp_verified_email تنظیم می‌شود تا کاربر بتواند ثبت‌نام/بازنشانی رمز را تکمیل کند.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'code', 'type'],
                properties: {
                  email: {
                    type: 'string',
                    description: 'آدرس ایمیل کاربر',
                    example: 'user@example.com',
                  },
                  code: {
                    type: 'string',
                    description: 'کد ۶ رقمی ارسال شده به ایمیل',
                    example: '482910',
                  },
                  type: {
                    type: 'string',
                    enum: ['signup', 'reset_password'],
                    description: 'نوع OTP — مقدار مجاز: signup یا reset_password',
                    example: 'signup',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'کد با موفقیت تایید شد',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    verified: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          400: {
            description:
              'کد وارد شده اشتباه است / کد منقضی شده است — لطفاً کد جدید درخواست کنید / این کد قبلاً استفاده شده است',
            content: {
              'application/json': {
                examples: {
                  wrong: {
                    summary: 'کد اشتباه',
                    value: { message: 'کد وارد شده اشتباه است' },
                  },
                  expired: {
                    summary: 'کد منقضی',
                    value: { message: 'کد منقضی شده است — لطفاً کد جدید درخواست کنید' },
                  },
                  used: {
                    summary: 'کد قبلاً استفاده شده',
                    value: { message: 'این کد قبلاً استفاده شده است' },
                  },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: {
            description: 'کد معتبری یافت نشد',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'کد معتبری یافت نشد' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/auth/register': {
      post: {
        tags: ['احراز هویت'],
        summary: 'ثبت‌نام کاربر جدید',
        description:
          'ثبت‌نام کاربر جدید. پیش از فراخوانی این endpoint باید OTP ایمیل با نوع signup تایید شده باشد (در غیر این صورت پاسخ 403 برمی‌گردد).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'mobile',
                  'email',
                  'national_id',
                  'birth_date',
                  'password',
                  'confirm_password',
                ],
                properties: {
                  mobile: {
                    type: 'string',
                    description: 'شماره موبایل (فرمت: 09xxxxxxxxx)',
                    example: '09121234567',
                  },
                  email: {
                    type: 'string',
                    description: 'آدرس ایمیل تایید شده',
                    example: 'user@example.com',
                  },
                  national_id: {
                    type: 'string',
                    description: 'کد ملی ۱۰ رقمی',
                    example: '0012345678',
                  },
                  birth_date: {
                    type: 'string',
                    description: 'تاریخ تولد به فرمت YYYY-MM-DD میلادی',
                    example: '1990-05-12',
                  },
                  password: {
                    type: 'string',
                    description:
                      'رمز عبور (حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ، یک کاراکتر خاص)',
                    example: 'MyPass@123',
                  },
                  confirm_password: {
                    type: 'string',
                    description: 'تکرار رمز عبور',
                    example: 'MyPass@123',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'ثبت‌نام موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'ثبت‌نام با موفقیت انجام شد',
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'رمز عبور و تکرار آن یکسان نیستند',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'رمز عبور و تکرار آن یکسان نیستند' },
              },
            },
          },
          403: {
            description: 'ایمیل تایید نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  message: 'ایمیل تایید نشده است — لطفاً ابتدا OTP را تایید کنید',
                },
              },
            },
          },
          409: {
            description: 'اطلاعات تکراری',
            content: {
              'application/json': {
                examples: {
                  mobile: {
                    summary: 'شماره موبایل تکراری',
                    value: { message: 'این شماره موبایل قبلاً ثبت شده است' },
                  },
                  email: {
                    summary: 'ایمیل تکراری',
                    value: { message: 'این ایمیل قبلاً ثبت شده است' },
                  },
                  national_id: {
                    summary: 'کد ملی تکراری',
                    value: { message: 'این کد ملی قبلاً ثبت شده است' },
                  },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          422: {
            description: 'خطای اعتبارسنجی ورودی‌ها',
            content: {
              'application/json': {
                examples: {
                  password: {
                    summary: 'رمز عبور ضعیف',
                    value: {
                      message:
                        'رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد',
                    },
                  },
                  national_id: {
                    summary: 'کد ملی نامعتبر',
                    value: {
                      message: 'فرمت کد ملی معتبر نیست — باید ۱۰ رقم عددی باشد',
                    },
                  },
                  birth_date_future: {
                    summary: 'تاریخ تولد در آینده',
                    value: { message: 'تاریخ تولد نمی‌تواند در آینده باشد' },
                  },
                  birth_date_too_old: {
                    summary: 'سن بیش از حد',
                    value: {
                      message: 'تاریخ تولد معتبر نیست — حداکثر سن مجاز ۱۲۰ سال است',
                    },
                  },
                  birth_date_format: {
                    summary: 'فرمت تاریخ تولد نامعتبر',
                    value: { message: 'فرمت تاریخ تولد معتبر نیست' },
                  },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/auth/forgot-password': {
      post: {
        tags: ['احراز هویت'],
        summary: 'درخواست بازیابی رمز عبور',
        description:
          'با دریافت ایمیل کاربر، یک OTP از نوع reset_password ساخته و به ایمیل ارسال می‌کند.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: {
                    type: 'string',
                    description: 'آدرس ایمیل حساب کاربری',
                    example: 'user@example.com',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'ارسال موفق کد بازیابی',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'کد بازیابی به ایمیل شما ارسال شد',
                    },
                  },
                },
              },
            },
          },
          404: {
            description: 'حساب کاربری یافت نشد',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'حسابی با این ایمیل یافت نشد' },
              },
            },
          },
          422: {
            description: 'ایمیل نامعتبر',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'آدرس ایمیل معتبر نیست' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/stories': {
      get: {
        tags: ['استوری‌ها'],
        summary: 'دریافت لیست استوری‌های فعال',
        description:
          'لیست استوری‌های فعال (is_active = 1) را به ترتیب order_index برمی‌گرداند. این endpoint نیازمند ورود کاربر است.',
        responses: {
          200: {
            description: 'لیست استوری‌ها',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    stories: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer', example: 1 },
                          order_index: { type: 'integer', example: 1 },
                          image_url: {
                            type: 'string',
                            example: '/uploads/stories/placeholder.jpg',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/stories/status': {
      get: {
        tags: ['استوری‌ها'],
        summary: 'بررسی وضعیت مشاهده استوری توسط کاربر',
        description:
          'فلگ has_seen_stories کاربر فعلی را بر می‌گرداند تا فرانت تصمیم بگیرد آیا استوری‌ها را نمایش بدهد یا خیر.',
        responses: {
          200: {
            description: 'وضعیت مشاهده',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    has_seen_stories: { type: 'integer', enum: [0, 1], example: 0 },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
        },
      },
    },

    '/api/stories/mark-seen': {
      post: {
        tags: ['استوری‌ها'],
        summary: 'ثبت مشاهده استوری توسط کاربر',
        description:
          'پس از دیدن آخرین استوری توسط کاربر، فلگ has_seen_stories کاربر را به ۱ تغییر می‌دهد. این endpoint بدون بدنه فراخوانی می‌شود.',
        responses: {
          200: {
            description: 'ثبت موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/admin/stories': {
      get: {
        tags: ['مدیریت استوری‌ها (ادمین)'],
        summary: 'لیست استوری‌ها (ادمین)',
        description: 'بازگشت تمام استوری‌ها با ترتیب order_index برای پنل مدیریت.',
        responses: {
          200: {
            description: 'لیست استوری‌ها',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    stories: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          order_index: { type: 'integer' },
                          image_path: { type: 'string' },
                          image_url: { type: 'string' },
                          is_active: { type: 'integer', enum: [0, 1] },
                          created_at: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'session ادمین لازم است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/admin/stories/{id}': {
      patch: {
        tags: ['مدیریت استوری‌ها (ادمین)'],
        summary: 'ویرایش استوری (ادمین)',
        description: 'بروزرسانی is_active و/یا order_index.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  is_active: { type: 'integer', enum: [0, 1] },
                  order_index: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'success', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } } } } },
          400: { description: 'اعتبارسنجی', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'session ادمین', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      delete: {
        tags: ['مدیریت استوری‌ها (ادمین)'],
        summary: 'حذف استوری (ادمین)',
        description: 'حذف رکورد از stories و فایل تصویر از دیسک.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'success', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } } } } },
          404: { description: 'یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'session ادمین', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/admin/stories/upload': {
      post: {
        tags: ['مدیریت استوری‌ها (ادمین)'],
        summary: 'آپلود تصویر استوری جدید (ادمین)',
        description:
          'یک تصویر استوری جدید از سمت ادمین آپلود و در جدول stories ثبت می‌کند. فرمت‌های مجاز: jpg، jpeg، png، webp. حداکثر حجم فایل: ۵ مگابایت. این مسیر در حال حاضر با middleware ادمین placeholder محافظت می‌شود (req.session.isAdmin === true) و در فاز ۳ به ورود ادمین متصل خواهد شد.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['image', 'order_index'],
                properties: {
                  image: {
                    type: 'string',
                    format: 'binary',
                    description: 'فایل تصویر استوری',
                  },
                  order_index: {
                    type: 'integer',
                    description: 'ترتیب نمایش استوری',
                    example: 1,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'آپلود موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    story: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', example: 4 },
                        order_index: { type: 'integer', example: 1 },
                        image_url: {
                          type: 'string',
                          example: '/uploads/stories/story_1718099999000_intro.jpg',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'خطای اعتبارسنجی فایل یا ترتیب نمایش',
            content: {
              'application/json': {
                examples: {
                  mime: {
                    summary: 'فرمت غیرمجاز',
                    value: {
                      message: 'فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود',
                    },
                  },
                  size: {
                    summary: 'حجم زیاد',
                    value: { message: 'حجم فایل بیش از ۵ مگابایت است' },
                  },
                  order: {
                    summary: 'ترتیب نامعتبر',
                    value: {
                      message: 'ترتیب نمایش معتبر نیست — باید عدد صحیح و بزرگ‌تر از صفر باشد',
                    },
                  },
                  missing: {
                    summary: 'فایل ارسال نشده',
                    value: { message: 'فایل تصویر ارسال نشده است' },
                  },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'دسترسی غیرمجاز (نقش ادمین لازم است)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'دسترسی غیرمجاز' },
              },
            },
          },
          500: {
            description: 'خطای سرور در آپلود فایل',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور در آپلود فایل' },
              },
            },
          },
        },
      },
    },

    '/api/admin/stories/reset-for-users': {
      post: {
        tags: ['مدیریت استوری‌ها (ادمین)'],
        summary: 'اجرای مجدد استوری برای همه کاربران (ادمین)',
        description:
          'فلگ has_seen_stories را برای همه کاربران به ۰ تغییر می‌دهد تا در ورود بعدی، استوری‌ها دوباره پخش شوند.',
        responses: {
          200: {
            description: 'ریست موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'استوری برای همه کاربران ریست شد',
                    },
                    affected_users: { type: 'integer', example: 42 },
                  },
                },
              },
            },
          },
          401: {
            description: 'دسترسی غیرمجاز',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'دسترسی غیرمجاز' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/auth/reset-password': {
      post: {
        tags: ['احراز هویت'],
        summary: 'تنظیم رمز عبور جدید',
        description:
          'پس از تایید OTP از نوع reset_password، رمز عبور جدید کاربر را تنظیم می‌کند.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'new_password', 'confirm_password'],
                properties: {
                  email: {
                    type: 'string',
                    description: 'آدرس ایمیل کاربر',
                    example: 'user@example.com',
                  },
                  new_password: {
                    type: 'string',
                    description:
                      'رمز عبور جدید (حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ، یک کاراکتر خاص)',
                    example: 'NewPass@123',
                  },
                  confirm_password: {
                    type: 'string',
                    description: 'تکرار رمز عبور جدید',
                    example: 'NewPass@123',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'تغییر موفق رمز عبور',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'رمز عبور با موفقیت تغییر یافت',
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'رمز عبور و تکرار آن یکسان نیستند',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'رمز عبور و تکرار آن یکسان نیستند' },
              },
            },
          },
          403: {
            description: 'تایید OTP انجام نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  message: 'تایید OTP انجام نشده است — لطفاً ابتدا کد را تایید کنید',
                },
              },
            },
          },
          422: {
            description: 'رمز عبور با قوانین پیچیدگی مطابقت ندارد',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  message:
                    'رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد',
                },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    // ════════════════════════════════════════════════════════
    //                Phase 3 — Auth: logout
    // ════════════════════════════════════════════════════════

    '/api/auth/logout': {
      post: {
        tags: ['احراز هویت'],
        summary: 'خروج از حساب کاربری',
        description: 'session فعلی کاربر را در سرور حذف می‌کند و کوکی session را پاک می‌کند. به صورت idempotent — حتی اگر کاربر وارد نشده باشد، با موفقیت پاسخ می‌دهد.',
        responses: {
          200: {
            description: 'خروج موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'با موفقیت خارج شدید' },
                  },
                },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    // ════════════════════════════════════════════════════════
    //                Phase 3 — Profile
    // ════════════════════════════════════════════════════════

    '/api/profile': {
      get: {
        tags: ['پروفایل'],
        summary: 'دریافت اطلاعات پروفایل کاربر',
        description: 'تمام اطلاعات پروفایل کاربر جاری را به همراه سطح احراز هویت و وضعیت اشتراک برمی‌گرداند. رمز عبور هرگز برگشت داده نمی‌شود.',
        responses: {
          200: {
            description: 'اطلاعات پروفایل',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id:                    { type: 'integer', example: 1 },
                    mobile:                { type: 'string',  example: '09121234567' },
                    email:                 { type: 'string',  example: 'user@example.com' },
                    national_id:           { type: 'string',  example: '0012345678' },
                    birth_date:            { type: 'string',  example: '1990-05-12' },
                    first_name:            { type: 'string',  example: 'فرید' },
                    last_name:             { type: 'string',  example: 'محمدی' },
                    address:               { type: 'string',  example: 'تهران، خیابان ولیعصر' },
                    postal_code:           { type: 'string',  example: '1234567890' },
                    verification_level:    { type: 'integer', enum: [0, 1, 2, 3], example: 1 },
                    subscription_plan:     { type: 'string',  enum: ['silver', 'gold', 'diamond'], nullable: true, example: 'gold' },
                    subscription_plan_name:{ type: 'string',  nullable: true, example: 'طلایی' },
                    subscription_expires_at:{ type: 'string', nullable: true, example: '2025-09-01' },
                    is_subscription_active:{ type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['پروفایل'],
        summary: 'بروزرسانی اطلاعات پروفایل',
        description: 'فیلدهای پروفایل کاربر را بروزرسانی می‌کند. فقط فیلدهای ارسال شده تغییر می‌کنند. برخی فیلدها بسته به سطح احراز هویت کاربر قابل ویرایش نیستند:\n\n- ایمیل: همیشه فقط‌خواندنی\n- شماره موبایل و کد ملی: پس از احراز سطح ۱\n- تاریخ تولد: پس از احراز سطح ۲\n- آدرس و کدپستی: پس از احراز سطح ۳',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  first_name:  { type: 'string', example: 'فرید', description: 'نام (همیشه قابل ویرایش)' },
                  last_name:   { type: 'string', example: 'محمدی', description: 'نام خانوادگی (همیشه قابل ویرایش)' },
                  address:     { type: 'string', example: 'تهران، خیابان ولیعصر', description: 'آدرس — فقط اگر verification_level < 3 باشد قابل ویرایش است' },
                  postal_code: { type: 'string', example: '1234567890', description: 'کدپستی ۱۰ رقمی — فقط اگر verification_level < 3 باشد قابل ویرایش است' },
                  national_id: { type: 'string', example: '0012345678', description: 'کد ملی ۱۰ رقمی — فقط اگر verification_level < 1 باشد قابل ویرایش است' },
                  birth_date:  { type: 'string', example: '1990-05-12', description: 'تاریخ تولد به فرمت YYYY-MM-DD — فقط اگر verification_level < 2 باشد قابل ویرایش است' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'بروزرسانی موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'اطلاعات با موفقیت بروزرسانی شد' },
                    updated_fields: { type: 'array', items: { type: 'string' }, example: ['first_name', 'last_name'] },
                  },
                },
              },
            },
          },
          400: {
            description: 'هیچ فیلدی برای بروزرسانی ارسال نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'هیچ فیلدی برای بروزرسانی ارسال نشده است' },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          403: {
            description: 'تلاش برای ویرایش فیلدی که به‌دلیل احراز هویت قفل شده است',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'این فیلد به دلیل احراز هویت قابل ویرایش نیست' },
                    locked_fields: { type: 'array', items: { type: 'string' }, example: ['national_id'] },
                  },
                },
              },
            },
          },
          409: {
            description: 'تداخل با داده‌های موجود (مثلاً کد ملی تکراری)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'این کد ملی قبلاً ثبت شده است' },
              },
            },
          },
          422: {
            description: 'خطای اعتبارسنجی فیلدها',
            content: {
              'application/json': {
                examples: {
                  postal: { summary: 'کدپستی نامعتبر', value: { message: 'کدپستی باید ۱۰ رقم عددی باشد' } },
                  national: { summary: 'کد ملی نامعتبر', value: { message: 'کد ملی باید ۱۰ رقم عددی باشد' } },
                  birth: { summary: 'تاریخ تولد نامعتبر', value: { message: 'فرمت تاریخ تولد معتبر نیست' } },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/profile/change-password': {
      post: {
        tags: ['پروفایل'],
        summary: 'تغییر رمز عبور',
        description: 'رمز عبور کاربر را تغییر می‌دهد. رمز عبور جدید باید با قوانین پیچیدگی مطابقت داشته باشد و نمی‌تواند با رمز فعلی یکسان باشد.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['current_password', 'new_password', 'confirm_password'],
                properties: {
                  current_password: { type: 'string', description: 'رمز عبور فعلی', example: 'OldPass@123' },
                  new_password:     { type: 'string', description: 'رمز عبور جدید', example: 'NewPass@456' },
                  confirm_password: { type: 'string', description: 'تکرار رمز عبور جدید', example: 'NewPass@456' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'تغییر موفق رمز عبور',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'رمز عبور با موفقیت تغییر یافت' },
                  },
                },
              },
            },
          },
          400: {
            description: 'فیلدها تکمیل نشده‌اند یا رمز جدید با فعلی یکسان است / تکرار رمز اشتباه',
            content: {
              'application/json': {
                examples: {
                  same: { summary: 'یکسان با رمز فعلی', value: { message: 'رمز عبور جدید نمیتواند با رمز فعلی یکسان باشد' } },
                  mismatch: { summary: 'تکرار اشتباه', value: { message: 'رمز عبور و تکرار آن یکسان نیستند' } },
                  missing: { summary: 'فیلد ناقص', value: { message: 'تمام فیلدها الزامی هستند' } },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'رمز عبور فعلی اشتباه است (یا کاربر وارد سیستم نشده)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'رمز عبور فعلی اشتباه است' },
              },
            },
          },
          422: {
            description: 'رمز عبور با قوانین پیچیدگی مطابقت ندارد',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/profile/devices': {
      get: {
        tags: ['دستگاه‌ها'],
        summary: 'دستگاه‌های متصل به حساب',
        description: 'لیست دستگاه‌هایی که با حساب کاربری وارد شده‌اند، به ترتیب آخرین فعالیت.',
        responses: {
          200: {
            description: 'لیست دستگاه‌ها',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    devices: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id:            { type: 'integer', example: 7 },
                          device_name:   { type: 'string', example: 'Chrome on macOS' },
                          device_type:   { type: 'string', enum: ['mobile', 'tablet', 'desktop'], example: 'desktop' },
                          ip_address:    { type: 'string', example: '127.0.0.1' },
                          last_active:   { type: 'string', example: '2026-06-11T19:30:00.000Z' },
                          created_at:    { type: 'string', example: '2026-06-10T08:00:00.000Z' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/profile/devices/{deviceId}': {
      delete: {
        tags: ['دستگاه‌ها'],
        summary: 'حذف دستگاه متصل',
        description: 'دستگاه مشخص‌شده توسط deviceId را از لیست دستگاه‌های متصل حذف می‌کند. فقط دستگاه‌های متعلق به همان کاربر قابل حذف هستند.',
        parameters: [
          {
            name: 'deviceId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'شناسه دستگاه',
            example: 7,
          },
        ],
        responses: {
          200: {
            description: 'حذف موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'دستگاه با موفقیت حذف شد' },
                  },
                },
              },
            },
          },
          400: {
            description: 'شناسه دستگاه معتبر نیست',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'شناسه دستگاه معتبر نیست' },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          404: {
            description: 'دستگاه یافت نشد یا متعلق به کاربر دیگری است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'دستگاه یافت نشد' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/profile/invite-code': {
      get: {
        tags: ['پروفایل'],
        summary: 'دریافت کد دعوت کاربر',
        description: 'کد دعوت اختصاصی کاربر را برمی‌گرداند. فعلاً به‌صورت ساده DKHL-{userId} است.',
        responses: {
          200: {
            description: 'کد دعوت',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    invite_code: { type: 'string', example: 'DKHL-42' },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
        },
      },
    },

    // ════════════════════════════════════════════════════════
    //                Phase 3 — Verification levels
    // ════════════════════════════════════════════════════════

    '/api/verification/status': {
      get: {
        tags: ['سطح احراز هویت'],
        summary: 'وضعیت احراز هویت کاربر',
        description: 'سطح فعلی احراز هویت کاربر، درخواست در انتظار (در صورت وجود) و تاریخچه‌ی هر سطح را برمی‌گرداند.',
        responses: {
          200: {
            description: 'وضعیت احراز هویت',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    current_level: { type: 'integer', enum: [0, 1, 2, 3], example: 1 },
                    pending_request: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'integer', example: 5 },
                        requested_level: { type: 'integer', example: 2 },
                        status: { type: 'string', example: 'pending' },
                        created_at: { type: 'string', example: '2026-06-11T19:00:00.000Z' },
                      },
                    },
                    levels: {
                      type: 'array',
                      description: 'وضعیت هر سطح (۱ تا ۳)',
                      items: {
                        type: 'object',
                        properties: {
                          level: { type: 'integer' },
                          state: { type: 'string', enum: ['approved', 'pending', 'rejected', 'available', 'locked'] },
                          required_fields: { type: 'array', items: { type: 'string' } },
                          missing_fields:  { type: 'array', items: { type: 'string' } },
                          last_request: { type: 'object', nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/verification/request': {
      post: {
        tags: ['سطح احراز هویت'],
        summary: 'درخواست ارتقاء سطح احراز هویت',
        description: 'کاربر می‌تواند تنها سطح بعدی (current_level + 1) را درخواست دهد. درخواست تنها در صورتی پذیرفته می‌شود که فیلدهای موردنیاز در پروفایل تکمیل باشند و درخواست در حال بررسی دیگری وجود نداشته باشد.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['requested_level'],
                properties: {
                  requested_level: { type: 'integer', enum: [1, 2, 3], example: 2 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'درخواست ثبت شد',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'درخواست احراز هویت ثبت شد و در انتظار بررسی است' },
                    request_id: { type: 'integer', example: 8 },
                  },
                },
              },
            },
          },
          400: {
            description: 'سطح درخواستی معتبر نیست یا برابر current_level + 1 نیست',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'شما فقط می‌توانید سطح بعدی را درخواست دهید' },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          409: {
            description: 'یک درخواست در حال بررسی برای این کاربر وجود دارد',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'یک درخواست در حال بررسی دارید' },
              },
            },
          },
          422: {
            description: 'فیلدهای موردنیاز این سطح در پروفایل تکمیل نشده‌اند',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'لطفاً ابتدا اطلاعات مورد نیاز این سطح را در پروفایل تکمیل کنید: کد ملی' },
                    missing_fields: { type: 'array', items: { type: 'string' }, example: ['national_id'] },
                  },
                },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    // ════════════════════════════════════════════════════════
    //                Phase 3 — Subscription
    // ════════════════════════════════════════════════════════

    '/api/subscription/plans': {
      get: {
        tags: ['اشتراک'],
        summary: 'دریافت پلن‌های اشتراک',
        description: 'لیست پلن‌های اشتراک هاردکدشده در سرور را برمی‌گرداند. نیاز به ورود ندارد (برای نمایش به مهمان نیز قابل استفاده است).',
        responses: {
          200: {
            description: 'پلن‌های موجود',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    plans: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          key:              { type: 'string', enum: ['silver', 'gold', 'diamond'] },
                          name:             { type: 'string', example: 'طلایی' },
                          duration_months:  { type: 'integer', example: 6 },
                          price:            { type: 'integer', example: 3500000, description: 'قیمت به تومان' },
                          label:            { type: 'string', example: '۶ ماهه' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/subscription/status': {
      get: {
        tags: ['اشتراک'],
        summary: 'وضعیت اشتراک کاربر',
        description: 'اشتراک فعلی کاربر، تعداد روزهای باقی‌مانده و درخواست در انتظار (در صورت وجود) را برمی‌گرداند.',
        responses: {
          200: {
            description: 'وضعیت اشتراک',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    plan:           { type: 'string', enum: ['silver', 'gold', 'diamond'], nullable: true, example: 'gold' },
                    plan_name:      { type: 'string', nullable: true, example: 'طلایی' },
                    expires_at:     { type: 'string', nullable: true, example: '2025-09-01' },
                    is_active:      { type: 'boolean', example: true },
                    days_remaining: { type: 'integer', nullable: true, example: 45 },
                    pending_request: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'integer', example: 12 },
                        plan: { type: 'string', example: 'gold' },
                        status: { type: 'string', example: 'pending' },
                        created_at: { type: 'string', example: '2026-06-11T19:00:00.000Z' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    '/api/subscription/request': {
      post: {
        tags: ['اشتراک'],
        summary: 'درخواست خرید اشتراک',
        description: 'یک درخواست خرید اشتراک ثبت می‌کند. قیمت همیشه از روی PLANS سرور خوانده می‌شود و قیمت ارسالی توسط client پذیرفته نمی‌شود.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['plan'],
                properties: {
                  plan: { type: 'string', enum: ['silver', 'gold', 'diamond'], example: 'gold', description: 'کلید پلن' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'درخواست ثبت شد',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:    { type: 'boolean', example: true },
                    message:    { type: 'string', example: 'درخواست اشتراک ثبت شد و در انتظار تایید ادمین است' },
                    request_id: { type: 'integer', example: 12 },
                    warning:    { type: 'string', nullable: true, example: 'شما در حال حاضر یک اشتراک فعال یا بالاتر دارید (طلایی).' },
                  },
                },
              },
            },
          },
          400: {
            description: 'پلن انتخابی معتبر نیست',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'پلن انتخابی معتبر نیست' },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
          409: {
            description: 'درخواست اشتراک در حال بررسی وجود دارد',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'یک درخواست اشتراک در حال بررسی دارید' },
              },
            },
          },
          500: {
            description: 'خطای سرور',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'خطای سرور' },
              },
            },
          },
        },
      },
    },

    // ════════════════════════════════════════════════════════
    //                Phase 3-D — Messages
    // ════════════════════════════════════════════════════════

    '/api/messages': {
      get: {
        tags: ['پیام‌ها'],
        summary: 'دریافت پیام‌های کاربر',
        description:
          'لیست پیام‌های کاربر فعلی را برمی‌گرداند. قبل از پاسخ، پیام‌های منقضی‌شده ' +
          '(`expires_at < now`) به‌صورت خودکار «خوانده شده» علامت‌گذاری می‌شوند تا قاعده‌ی ۷ روز ' +
          'حذف از زمان انقضا اعمال شود.\n\n' +
          'قواعد نمایش (در همان کوئری اعمال می‌شود):\n' +
          '۱) فقط پیام‌های همین کاربر\n' +
          '۲) پیام خوانده‌شده‌ای که بیش از ۷ روز از خواندنش گذشته نمایش داده نمی‌شود\n' +
          '۳) پیام خوانده‌شده‌ی قدیمی‌تر از ۲ ماه نمایش داده نمی‌شود\n' +
          '۴) پیام‌های منقضی نمایش داده می‌شوند ولی به‌صورت خودکار خوانده‌شده‌اند.',
        responses: {
          200: {
            description: 'لیست پیام‌ها',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    messages: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id:         { type: 'integer', example: 42 },
                          title:      { type: 'string', example: 'اشتراک طلایی فعال شد ✓' },
                          body:       { type: 'string', example: 'اشتراک طلایی شما با موفقیت فعال شد. تاریخ انقضا: ۱۴۰۴/۰۳/۲۱.' },
                          type:       {
                            type: 'string',
                            enum: [
                              'verification_request', 'verification_result',
                              'subscription_request', 'subscription_result',
                              'subscription_expiry_warning', 'subscription_expired',
                              'admin_broadcast', 'admin_direct',
                              'referral',
                            ],
                            example: 'subscription_result',
                          },
                          related_id: { type: 'integer', nullable: true, example: 7 },
                          is_read:    { type: 'boolean', example: false },
                          is_expired: { type: 'boolean', example: false },
                          expires_at: { type: 'string', nullable: true, example: '2026-06-19 22:00:00' },
                          read_at:    { type: 'string', nullable: true, example: null },
                          created_at: { type: 'string', example: '2026-06-12 22:00:00' },
                          time_ago:   { type: 'string', example: '۲ ساعت پیش' },
                        },
                      },
                    },
                    unread_count: { type: 'integer', example: 3 },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { message: 'لطفاً وارد حساب کاربری خود شوید' },
              },
            },
          },
        },
      },
    },

    '/api/messages/{id}/read': {
      patch: {
        tags: ['پیام‌ها'],
        summary: 'علامت‌گذاری پیام به عنوان خوانده شده',
        description:
          'پیام مشخص‌شده را برای کاربر فعلی خوانده‌شده می‌کند. ' +
          'اگر پیام متعلق به کاربر دیگری باشد، با خطای ۴۰۳ پاسخ داده می‌شود.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 42 },
        ],
        responses: {
          200: {
            description: 'علامت‌گذاری موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:      { type: 'boolean', example: true },
                    already_read: { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
          400: {
            description: 'شناسه پیام معتبر نیست',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'شناسه پیام معتبر نیست' } } },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } },
          },
          403: {
            description: 'پیام متعلق به کاربر دیگری است',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } },
          },
          404: {
            description: 'پیام یافت نشد',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'پیام یافت نشد' } } },
          },
        },
      },
    },

    '/api/messages/read-all': {
      patch: {
        tags: ['پیام‌ها'],
        summary: 'علامت‌گذاری همه پیام‌ها به‌عنوان خوانده شده',
        description: 'تمام پیام‌های نخوانده‌ی کاربر فعلی را خوانده‌شده می‌کند.',
        responses: {
          200: {
            description: 'موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:       { type: 'boolean', example: true },
                    updated_count: { type: 'integer', example: 4 },
                  },
                },
              },
            },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } },
          },
        },
      },
    },

    '/api/messages/{id}': {
      delete: {
        tags: ['پیام‌ها'],
        summary: 'حذف یک پیام',
        description: 'فقط پیام‌های **خوانده‌شده** قابل حذف هستند. حذف پیام نخوانده با ۴۰۰ پاسخ داده می‌شود.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 42 },
        ],
        responses: {
          200: {
            description: 'حذف موفق',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } },
              },
            },
          },
          400: {
            description: 'پیام نخوانده قابل حذف نیست یا شناسه نامعتبر است',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'پیام‌های خوانده نشده قابل حذف نیستند' } } },
          },
          401: {
            description: 'کاربر وارد سیستم نشده است',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } },
          },
          403: {
            description: 'پیام متعلق به کاربر دیگری است',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } },
          },
          404: {
            description: 'پیام یافت نشد',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'پیام یافت نشد' } } },
          },
        },
      },
    },

    // ════════════════════════════════════════════════════════
    //         Phase 3-D — Admin Messages
    // ════════════════════════════════════════════════════════

    '/api/admin/messages/send': {
      post: {
        tags: ['پیام‌رسانی ادمین'],
        summary: 'ارسال پیام به کاربران',
        description:
          'ارسال پیام گروهی (`target=all`) یا مستقیم (`target=user`). پوش نوتیفیکیشن به‌صورت non-blocking از طریق setImmediate ارسال می‌شود.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['target', 'title', 'body', 'expires_at'],
                properties: {
                  target:     { type: 'string', enum: ['all', 'user'], example: 'all' },
                  user_id:    { type: 'integer', example: 7, description: 'فقط وقتی target برابر user است الزامی است' },
                  title:      { type: 'string', maxLength: 80 },
                  body:       { type: 'string', maxLength: 1000 },
                  expires_at: { type: 'string', example: '2026-12-31T23:59:00.000Z' },
                  send_push:  { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'ارسال موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:    { type: 'boolean', example: true },
                    sent_count: { type: 'integer', example: 142 },
                    push_queued: { type: 'boolean', example: true },
                    message:    { type: 'string', example: 'پیام با موفقیت برای ۱۴۲ کاربر ارسال شد' },
                  },
                },
              },
            },
          },
          400: {
            description: 'ورودی نامعتبر — یکی از خطاهای زیر',
            content: {
              'application/json': {
                examples: {
                  expired: { summary: 'تاریخ انقضا گذشته', value: { message: 'تاریخ انقضا باید در آینده باشد' } },
                  missingUid: { summary: 'user_id نداده', value: { message: 'user_id الزامی است وقتی target برابر user است' } },
                  badTarget: { summary: 'target اشتباه', value: { message: 'مقدار target نامعتبر است — مقادیر مجاز: all یا user' } },
                  badTitle: { summary: 'عنوان طولانی', value: { message: 'عنوان نمی‌تواند بیش از ۸۰ کاراکتر باشد' } },
                  badBody: { summary: 'متن طولانی', value: { message: 'متن پیام نمی‌تواند بیش از ۱۰۰۰ کاراکتر باشد' } },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'دسترسی ادمین وجود ندارد',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } },
          },
          422: {
            description: 'اعتبارسنجی عنوان/متن',
            content: { 'application/json': { example: { message: 'عنوان نمی‌تواند بیش از ۸۰ کاراکتر باشد' } } },
          },
          404: {
            description: 'کاربر مورد نظر یافت نشد (target=user)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'کاربر مورد نظر یافت نشد' } } },
          },
        },
      },
    },

    '/api/admin/messages/history': {
      get: {
        tags: ['پیام‌رسانی ادمین'],
        summary: 'تاریخچه پیام‌های ارسال شده توسط ادمین',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'target', in: 'query', schema: { type: 'string', enum: ['broadcast', 'user', 'direct'] } },
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['all', 'today', 'week', 'month'] } },
        ],
        responses: {
          200: { description: 'messages[] شامل read_rate و sent_by' },
          401: { description: 'session ادمین' },
        },
      },
    },

    '/api/admin/messages/stats': {
      get: {
        tags: ['پیام‌رسانی ادمین'],
        summary: 'آمار کلی پیام‌رسانی',
        responses: {
          200: {
            description: 'total_sent_today, total_sent_this_month, avg_read_rate, broadcast_count, direct_count',
          },
        },
      },
    },

    // ════════════════════════════════════════════════════════
    //       Phase 3 — Admin review (dev mode)
    // ════════════════════════════════════════════════════════

    '/api/admin/verifications': {
      get: {
        tags: ['مدیریت احراز و اشتراک (ادمین)'],
        summary: 'لیست درخواست‌های احراز هویت',
        description: 'تمام درخواست‌های احراز هویت به‌همراه اطلاعات کاربر، به ترتیب «در انتظار» اول. نیازمند `req.session.isAdmin === true`.',
        responses: {
          200: {
            description: 'لیست درخواست‌ها',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    requests: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer', example: 5 },
                          user_id: { type: 'integer', example: 7 },
                          requested_level: { type: 'integer', example: 2 },
                          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
                          admin_note: { type: 'string', nullable: true },
                          created_at: { type: 'string' },
                          reviewed_at: { type: 'string', nullable: true },
                          mobile: { type: 'string', example: '09121234567' },
                          email: { type: 'string', example: 'user@example.com' },
                          first_name: { type: 'string', nullable: true },
                          last_name: { type: 'string', nullable: true },
                          national_id: { type: 'string', nullable: true },
                          birth_date: { type: 'string', nullable: true },
                          postal_code: { type: 'string', nullable: true },
                          address: { type: 'string', nullable: true },
                          verification_level: { type: 'integer', example: 1 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/admin/verifications/{id}/approve': {
      post: {
        tags: ['مدیریت احراز و اشتراک (ادمین)'],
        summary: 'تایید درخواست احراز هویت',
        description: 'درخواست را تایید می‌کند، سطح احراز کاربر را افزایش می‌دهد و یک نوتیفیکیشن برای او ارسال می‌کند. این عملیات Atomic است.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 5 },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  note: { type: 'string', description: 'یادداشت اختیاری ادمین (حداکثر ۵۰۰ کاراکتر)', example: 'مدارک کامل بود' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'تایید موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'درخواست تایید شد' },
                    new_level: { type: 'integer', example: 2 },
                  },
                },
              },
            },
          },
          400: { description: 'شناسه نامعتبر', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'شناسه درخواست معتبر نیست' } } } },
          401: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          404: { description: 'درخواست یا کاربر یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'درخواست یافت نشد' } } } },
          409: {
            description: 'درخواست قبلاً بررسی شده یا با سطح فعلی کاربر همخوانی ندارد',
            content: {
              'application/json': {
                examples: {
                  alreadyReviewed: { summary: 'قبلاً بررسی شده', value: { message: 'این درخواست قبلاً تایید شده است' } },
                  levelMismatch:   { summary: 'سطح ناهماهنگ',  value: { message: 'سطح فعلی کاربر ۲ است؛ نمی‌توان مستقیماً به سطح ۳ ارتقاء داد' } },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/admin/verifications/{id}/reject': {
      post: {
        tags: ['مدیریت احراز و اشتراک (ادمین)'],
        summary: 'رد درخواست احراز هویت',
        description: 'درخواست را رد می‌کند، سطح احراز کاربر تغییری نمی‌کند و یک نوتیفیکیشن (شامل دلیل) ارسال می‌شود.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 5 },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  note: { type: 'string', description: 'دلیل رد (اختیاری اما توصیه می‌شود)', example: 'تاریخ تولد با کد ملی همخوان نیست' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'رد موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'درخواست رد شد' },
                  },
                },
              },
            },
          },
          400: { description: 'شناسه نامعتبر', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'شناسه درخواست معتبر نیست' } } } },
          401: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          404: { description: 'درخواست یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'درخواست یافت نشد' } } } },
          409: { description: 'درخواست قبلاً بررسی شده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'این درخواست قبلاً رد شده است' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/admin/subscriptions': {
      get: {
        tags: ['مدیریت احراز و اشتراک (ادمین)'],
        summary: 'لیست درخواست‌های اشتراک',
        description: 'تمام درخواست‌های اشتراک به‌همراه اطلاعات کاربر و اشتراک فعلی او.',
        responses: {
          200: {
            description: 'لیست درخواست‌ها',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    requests: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer', example: 12 },
                          user_id: { type: 'integer', example: 7 },
                          plan: { type: 'string', enum: ['silver', 'gold', 'diamond'], example: 'gold' },
                          plan_name: { type: 'string', example: 'طلایی' },
                          duration_months: { type: 'integer', example: 6 },
                          price: { type: 'integer', example: 3500000 },
                          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                          admin_note: { type: 'string', nullable: true },
                          created_at: { type: 'string' },
                          reviewed_at: { type: 'string', nullable: true },
                          mobile: { type: 'string' },
                          email: { type: 'string' },
                          first_name: { type: 'string', nullable: true },
                          last_name: { type: 'string', nullable: true },
                          subscription_plan: { type: 'string', nullable: true },
                          subscription_expires_at: { type: 'string', nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/admin/subscriptions/{id}/approve': {
      post: {
        tags: ['مدیریت احراز و اشتراک (ادمین)'],
        summary: 'تایید درخواست اشتراک و فعال‌سازی پلن',
        description: 'درخواست را تایید می‌کند، فیلدهای `subscription_plan` و `subscription_expires_at` کاربر را با مدت‌زمان همان پلن ست می‌کند (تاریخ انقضا = امروز + duration_months) و یک نوتیفیکیشن می‌فرستد. این عملیات Atomic است.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 12 },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  note: { type: 'string', description: 'یادداشت اختیاری (مثلاً شماره فاکتور)', example: 'فاکتور #12345' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'تایید موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'درخواست تایید و اشتراک فعال شد' },
                    plan: { type: 'string', example: 'gold' },
                    expires_at: { type: 'string', example: '2026-12-12' },
                  },
                },
              },
            },
          },
          400: { description: 'شناسه نامعتبر یا پلن نامعتبر', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'پلن این درخواست در سرور معتبر نیست' } } } },
          401: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          404: { description: 'درخواست یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'درخواست یافت نشد' } } } },
          409: { description: 'درخواست قبلاً بررسی شده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'این درخواست قبلاً تایید شده است' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/admin/subscriptions/{id}/reject': {
      post: {
        tags: ['مدیریت احراز و اشتراک (ادمین)'],
        summary: 'رد درخواست اشتراک',
        description: 'درخواست را رد می‌کند، اشتراک فعلی کاربر تغییری نمی‌کند و یک نوتیفیکیشن (شامل دلیل اختیاری) ارسال می‌شود.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 12 },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  note: { type: 'string', description: 'دلیل رد (اختیاری)', example: 'پرداخت تایید نشد' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'رد موفق', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } } } } },
          400: { description: 'شناسه نامعتبر', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'شناسه درخواست معتبر نیست' } } } },
          401: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          404: { description: 'درخواست یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'درخواست یافت نشد' } } } },
          409: { description: 'درخواست قبلاً بررسی شده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'این درخواست قبلاً رد شده است' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════
    //               Phase 3-B — Avatar
    // ════════════════════════════════════════════════════════

    '/api/avatar/list': {
      get: {
        tags: ['آواتار'],
        summary: 'دریافت لیست آواتارهای موجود',
        description: 'لیست تمام ۴۰ آواتار (۲۰ رایگان + ۲۰ ویژه اشتراک) به‌همراه آواتار فعلی کاربر و وضعیت قفل هر آواتار. این endpoint قبل از پاسخ، انقضای اشتراک کاربر را بررسی می‌کند تا قفل‌ها real-time باشد.',
        responses: {
          200: {
            description: 'لیست آواتارها',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    current: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['dicebear', 'custom'], example: 'dicebear' },
                        seed: { type: 'string', nullable: true, example: 'aria' },
                        url:  { type: 'string', example: 'https://api.dicebear.com/7.x/personas/svg?seed=aria&backgroundColor=b6e3f4' },
                        custom_path: { type: 'string', nullable: true, example: null },
                      },
                    },
                    can_upload: { type: 'boolean', example: false, description: 'فقط در صورت داشتن اشتراک فعال true است' },
                    has_active_subscription: { type: 'boolean', example: false },
                    avatars: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          seed:       { type: 'string', example: 'orion' },
                          url:        { type: 'string', example: 'https://api.dicebear.com/7.x/personas/svg?seed=orion&backgroundColor=f4d03f' },
                          is_premium: { type: 'boolean', example: true },
                          is_locked:  { type: 'boolean', example: true, description: 'true یعنی برای کاربر بدون اشتراک قفل است' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'کاربر وارد سیستم نشده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/avatar/select': {
      patch: {
        tags: ['آواتار'],
        summary: 'انتخاب آواتار DiceBear',
        description: 'یک آواتار از مجموعه‌ی ۴۰ آواتار را برای کاربر فعال می‌کند. آواتارهای ویژه نیازمند اشتراک فعال هستند. در صورت انتخاب آواتار، اگر عکس شخصی هم تنظیم شده بود، فایل آن حذف می‌شود.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['seed'],
                properties: {
                  seed: { type: 'string', example: 'orion', description: 'نام seed یکی از ۴۰ آواتار مجاز' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'تغییر موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'آواتار با موفقیت تغییر یافت' },
                    avatar_url: { type: 'string', example: 'https://api.dicebear.com/7.x/personas/svg?seed=orion&backgroundColor=f4d03f' },
                    seed: { type: 'string', example: 'orion' },
                    type: { type: 'string', example: 'dicebear' },
                  },
                },
              },
            },
          },
          400: { description: 'seed نامعتبر', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'آواتار انتخابی معتبر نیست' } } } },
          401: { description: 'کاربر وارد سیستم نشده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
          403: { description: 'آواتار ویژه — اشتراک فعال ندارید', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'این آواتار مخصوص کاربران دارای اشتراک فعال است' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/avatar/upload': {
      post: {
        tags: ['آواتار'],
        summary: 'آپلود عکس پروفایل شخصی',
        description: 'یک تصویر شخصی (jpg/png/webp تا ۳ مگابایت) به‌عنوان آواتار کاربر آپلود می‌کند. تنها برای کاربران دارای اشتراک فعال در دسترس است. اگر عکس قبلی وجود داشت، فایل آن از روی دیسک حذف می‌شود. نام فایل ذخیره‌شده فقط بر اساس userId و timestamp ساخته می‌شود (بدون استفاده از نام فایل ارسالی) تا از path traversal جلوگیری شود.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['photo'],
                properties: {
                  photo: { type: 'string', format: 'binary', description: 'فایل تصویر (jpg/png/webp)' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'آپلود موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'عکس پروفایل با موفقیت بارگذاری شد' },
                    avatar_url: { type: 'string', example: '/uploads/avatars/avatar_42_1718099999000.jpg' },
                    type: { type: 'string', example: 'custom' },
                  },
                },
              },
            },
          },
          400: {
            description: 'خطای فایل',
            content: {
              'application/json': {
                examples: {
                  mime: { summary: 'فرمت غیرمجاز', value: { message: 'فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود' } },
                  size: { summary: 'حجم زیاد',      value: { message: 'حجم فایل بیش از ۳ مگابایت است' } },
                  missing: { summary: 'فایل ارسال نشده', value: { message: 'فایل عکس ارسال نشده است' } },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: { description: 'کاربر وارد سیستم نشده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
          403: { description: 'بدون اشتراک فعال', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'آپلود عکس شخصی مخصوص کاربران دارای اشتراک فعال است' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور در آپلود فایل' } } } },
        },
      },
    },

    '/api/avatar/custom': {
      delete: {
        tags: ['آواتار'],
        summary: 'حذف عکس پروفایل شخصی و بازگشت به آواتار',
        description: 'عکس شخصی فعلی را از روی دیسک حذف می‌کند و آواتار کاربر را به آخرین seed انتخاب‌شده (`avatar_last_seed`) برمی‌گرداند.',
        responses: {
          200: {
            description: 'حذف موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'عکس حذف شد و آواتار قبلی بازگردانده شد' },
                    avatar_url: { type: 'string', example: 'https://api.dicebear.com/7.x/personas/svg?seed=aria&backgroundColor=b6e3f4' },
                    seed: { type: 'string', example: 'aria' },
                    type: { type: 'string', example: 'dicebear' },
                  },
                },
              },
            },
          },
          400: { description: 'عکس شخصی تنظیم نشده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'عکس شخصی تنظیم نشده است' } } } },
          401: { description: 'کاربر وارد سیستم نشده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    // ════════════════════════ Phase 3-C — Referral system ════════════════════════
    '/api/referral/validate/{code}': {
      get: {
        tags: ['سیستم دعوت'],
        summary: 'اعتبارسنجی کد دعوت',
        description: 'بررسی می‌کند که کد دعوت با الگوی `DKHL-{userId}` مطابقت دارد و کاربر دعوت‌کننده در دیتابیس موجود است. این مسیر **بدون نیاز به ورود** قابل فراخوانی است — فرم ثبت‌نام در زمان `blur` فیلد کد دعوت آن را صدا می‌زند تا نام دعوت‌کننده را به کاربر نشان دهد.\n\nبه دلایل حریم خصوصی، تنها «نام + حرف اول نام خانوادگی» دعوت‌کننده برگردانده می‌شود (مثال: «علی م.»).',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string', example: 'DKHL-42' }, description: 'کد دعوت با الگوی DKHL-{userId}' },
        ],
        responses: {
          200: {
            description: 'کد معتبر است',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    valid: { type: 'boolean', example: true },
                    inviter_name: { type: 'string', example: 'علی م.' },
                  },
                },
              },
            },
          },
          400: { description: 'فرمت کد دعوت صحیح نیست', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'فرمت کد دعوت صحیح نیست' } } } },
          404: { description: 'کد دعوت یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'کد دعوت معتبر نیست' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/referral/apply': {
      post: {
        tags: ['سیستم دعوت'],
        summary: 'ثبت کد دعوت هنگام ثبت‌نام',
        description: 'پس از موفقیت `POST /api/auth/register` و دریافت `user_id` در پاسخ، فرم ثبت‌نام این مسیر را با شناسه‌ی تازه‌ی کاربر و کد دعوت معتبر فراخوانی می‌کند.\n\n- این مسیر **بدون نیاز به session** قابل فراخوانی است (هنوز ورود رخ نداده).\n- کد دعوت تنها در همین لحظه قابل ثبت است — بعد از این کاربر دیگر امکان افزودن کد دعوت ندارد.\n- اگر دعوت‌کننده در زمان ثبت‌نام اشتراک فعال داشته باشد، یک رکورد `referral_discounts` (source = `invitee`) با اعتبار ۱۰ روز از زمان ثبت‌نام برای کاربر دعوت‌شده ایجاد می‌شود. این درصد در زمان خرید توسط ادمین به `final_price` اعمال خواهد شد.\n- پاداش دعوت‌کننده هنگام **تایید خرید** کاربر دعوت‌شده محاسبه و به دعوت‌کننده اعطا می‌شود (تا سقف ۵ دعوت موفق).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['invitee_user_id', 'invite_code'],
                properties: {
                  invitee_user_id: { type: 'integer', example: 42, description: 'شناسه‌ی عددی کاربر تازه‌ثبت‌نام‌شده (از پاسخ register)' },
                  invite_code: { type: 'string', example: 'DKHL-7', description: 'کد دعوت معتبر با الگوی DKHL-{userId}' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'کد دعوت با موفقیت ثبت شد',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string', example: 'کد دعوت با موفقیت ثبت شد' } } },
              },
            },
          },
          400: {
            description: 'ورودی نامعتبر',
            content: {
              'application/json': {
                examples: {
                  format:    { summary: 'فرمت کد', value: { message: 'فرمت کد دعوت صحیح نیست' } },
                  self:      { summary: 'کد خود کاربر', value: { message: 'نمی‌توانید از کد دعوت خود استفاده کنید' } },
                  user:      { summary: 'شناسه نامعتبر', value: { message: 'شناسه کاربر معتبر نیست' } },
                },
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          404: { description: 'کد دعوت یا کاربر یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'کد دعوت معتبر نیست' } } } },
          409: { description: 'کد قبلاً ثبت شده', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'کد دعوت قبلاً ثبت شده است' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/referral/discount': {
      get: {
        tags: ['سیستم دعوت'],
        summary: 'دریافت تخفیف فعال کاربر برای خرید اشتراک',
        description: 'تخفیف فعال کاربر را برمی‌گرداند (فقط نوع `invitee` در این endpoint — تخفیف انباشته‌ی دعوت‌کننده در `GET /api/subscription/status` با کلید `pending_inviter_discounts` بازگشت می‌شود).\n\nتخفیف کاربر دعوت‌شده فقط در صورتی برگشت داده می‌شود که هنوز مصرف نشده باشد و `expires_at` آن نگذشته باشد.',
        responses: {
          200: {
            description: 'وضعیت تخفیف فعلی کاربر',
            content: {
              'application/json': {
                examples: {
                  has:  { summary: 'دارای تخفیف', value: { has_discount: true, discount_percent: 5, expires_at: '2025-07-10 00:00:00', source: 'invitee' } },
                  none: { summary: 'بدون تخفیف', value: { has_discount: false } },
                },
                schema: {
                  type: 'object',
                  properties: {
                    has_discount: { type: 'boolean' },
                    discount_percent: { type: 'number', example: 5 },
                    expires_at: { type: 'string', nullable: true, example: '2025-07-10 00:00:00' },
                    source: { type: 'string', example: 'invitee' },
                  },
                },
              },
            },
          },
          401: { description: 'کاربر وارد سیستم نشده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/referral/my-invites': {
      get: {
        tags: ['سیستم دعوت'],
        summary: 'لیست افراد دعوت‌شده توسط کاربر',
        description: 'پنل دعوت‌کننده — کد دعوت اختصاصی، تعداد دعوت‌ها، تعداد تخفیف‌های کسب‌شده (از سقف ۵)، مجموع درصد تخفیف انباشته برای خرید بعدی، و لیست افراد دعوت‌شده با نام ماسک‌شده.',
        responses: {
          200: {
            description: 'داده‌های دعوت کاربر',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total_invites:                     { type: 'integer', example: 7 },
                    discount_earned_count:             { type: 'integer', example: 3 },
                    discount_remaining:                { type: 'integer', example: 2 },
                    pending_inviter_discount_percent:  { type: 'number',  example: 4 },
                    invite_code:                       { type: 'string',  example: 'DKHL-42' },
                    invites: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id:                     { type: 'integer', example: 1 },
                          invitee_name:           { type: 'string',  example: 'س. احمدی' },
                          joined_at:              { type: 'string',  example: '2025-06-01 14:22:00' },
                          purchased_subscription: { type: 'boolean', example: true },
                          discount_earned:        { type: 'string',  nullable: true, example: '2%' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'کاربر وارد سیستم نشده است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/admin/referrals': {
      get: {
        tags: ['سیستم دعوت (ادمین)'],
        summary: 'لیست روابط دعوت کاربران (ادمین)',
        description: 'لیست همه‌ی روابط دعوت برای پنل ادمین. نام‌ها و شماره موبایل به‌صورت ماسک‌شده برمی‌گردد.',
        responses: {
          200: {
            description: 'لیست روابط دعوت',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    referrals: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id:                        { type: 'integer', example: 1 },
                          inviter: {
                            type: 'object',
                            properties: {
                              id:                { type: 'integer', example: 7 },
                              name:              { type: 'string',  example: 'علی م.' },
                              mobile:            { type: 'string',  example: '0912***1122' },
                              subscription_plan: { type: 'string',  nullable: true, example: 'gold' },
                            },
                          },
                          invitee: {
                            type: 'object',
                            properties: {
                              id:        { type: 'integer', example: 42 },
                              name:      { type: 'string',  example: 'س. احمدی' },
                              mobile:    { type: 'string',  example: '0912***9988' },
                              joined_at: { type: 'string',  example: '2025-06-01 14:22:00' },
                            },
                          },
                          inviter_plan_at_signup:   { type: 'string', nullable: true, example: 'gold' },
                          purchase_resulted:        { type: 'boolean', example: true },
                          inviter_discount_earned:  { type: 'string', nullable: true, example: '2%' },
                          invitee_discount_applied: { type: 'string', nullable: true, example: '5%' },
                          created_at:               { type: 'string', example: '2025-06-01 14:22:30' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    '/api/admin/referrals/stats': {
      get: {
        tags: ['سیستم دعوت (ادمین)'],
        summary: 'آمار کلی سیستم دعوت (ادمین)',
        description: 'آمار سراسری برای داشبورد ادمین: تعداد کل روابط دعوت، تعداد دعوت‌های منجر به خرید، مجموع درصد تخفیف اعطا شده و فهرست ۱۰ دعوت‌کننده‌ی برتر.',
        responses: {
          200: {
            description: 'آمار کلی',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total_referrals:              { type: 'integer', example: 42 },
                    successful_referrals:         { type: 'integer', example: 18 },
                    total_discount_given_percent: { type: 'number',  example: 85 },
                    top_inviters: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          user_id:         { type: 'integer', example: 7 },
                          name:            { type: 'string',  example: 'علی م.' },
                          invite_count:    { type: 'integer', example: 12 },
                          discount_earned: { type: 'integer', example: 5 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'خطای سرور' } } } },
        },
      },
    },

    // ──────────────────────────── Phase 3-F — Web Push ────────────────────
    '/api/push/vapid-public-key': {
      get: {
        tags: ['پوش نوتیفیکیشن'],
        summary: 'دریافت کلید عمومی VAPID',
        description:
          'کلید عمومی VAPID که فرانت‌اند برای ساخت push subscription از مرورگر استفاده می‌کند. این endpoint عمومی است (نیاز به لاگین ندارد). اگر کلیدها در سرور تنظیم نشده باشند پاسخ 503 برمی‌گردد.',
        responses: {
          200: {
            description: 'کلید عمومی',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    publicKey: { type: 'string', example: 'BAkj…q_w' },
                  },
                },
              },
            },
          },
          503: {
            description: 'سرویس پوش غیرفعال است',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'سرویس پوش نوتیفیکیشن در حال حاضر در دسترس نیست', publicKey: null } } },
          },
        },
      },
    },

    '/api/push/subscribe': {
      post: {
        tags: ['پوش نوتیفیکیشن'],
        summary: 'ثبت یا بروزرسانی push subscription',
        description:
          'ثبت یا بروزرسانی subscription کاربر در دیتابیس. اگر همان endpoint قبلاً ثبت شده باشد، به user_id جدید و کلیدهای جدید بروز می‌شود (INSERT OR REPLACE با endpoint به‌عنوان کلید یکتا).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['endpoint', 'keys'],
                properties: {
                  endpoint: { type: 'string', example: 'https://fcm.googleapis.com/fcm/send/abc...' },
                  keys: {
                    type: 'object',
                    required: ['p256dh', 'auth'],
                    properties: {
                      p256dh: { type: 'string', example: 'BFAk…' },
                      auth:   { type: 'string', example: 'q4kK…' },
                    },
                  },
                  userAgent: { type: 'string', example: 'Mozilla/5.0 …' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'ثبت شد', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } } } } },
          400: { description: 'داده‌ی نامعتبر', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'لازم است وارد شوید', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    // ──────────────────────────── Phase 4 — Categories ─────────────────────
    '/api/categories': {
      get: {
        tags: ['دسته‌بندی‌ها'],
        summary: 'دریافت دسته‌بندی‌های در دسترس کاربر',
        description: 'دسته‌بندی‌های پیش‌فرض سیستم به علاوه‌ی دسته‌های سفارشی تایید‌شده‌ی کاربر فعلی. می‌توان با پارامتر type نتایج را فیلتر کرد.',
        parameters: [
          {
            in: 'query', name: 'type', required: false,
            description: 'نوع دسته‌بندی — expense | income | both',
            schema: { type: 'string', enum: ['expense', 'income', 'both'] },
          },
        ],
        responses: {
          200: {
            description: 'لیست دسته‌بندی‌ها',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    categories: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id:         { type: 'integer', example: 1 },
                          name:       { type: 'string',  example: 'خوراک و رستوران' },
                          icon:       { type: 'string',  example: '🍽️' },
                          color:      { type: 'string',  example: '#EF4444' },
                          type:       { type: 'string',  example: 'expense' },
                          is_default: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'لازم است وارد شوید', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
          500: { description: 'خطای سرور',         content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/categories/request': {
      post: {
        tags: ['دسته‌بندی‌ها'],
        summary: 'درخواست افزودن دسته‌بندی جدید',
        description: 'کاربر یک دسته‌بندی سفارشی پیشنهاد می‌دهد؛ ادمین آن را تایید یا رد می‌کند. کاربر نمی‌تواند هم‌زمان چند درخواست با یک نام در صف داشته باشد.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'icon', 'color', 'type'],
                properties: {
                  name:  { type: 'string', maxLength: 30, example: 'هزینه خودرو' },
                  icon:  { type: 'string', example: '🚙' },
                  color: { type: 'string', example: '#1A5C3A', description: 'کد رنگ hex مانند #1A5C3A' },
                  type:  { type: 'string', enum: ['expense', 'income', 'both'], example: 'expense' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'درخواست ثبت شد',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:    { type: 'boolean', example: true },
                    message:    { type: 'string',  example: 'درخواست دسته‌بندی ثبت شد' },
                    request_id: { type: 'integer', example: 7 },
                  },
                },
              },
            },
          },
          409: { description: 'درخواست تکراری در صف', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'درخواست مشابهی در حال بررسی است' } } } },
          422: { description: 'داده‌ی نامعتبر',           content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'نام دسته‌بندی نمی‌تواند بیش از ۳۰ کاراکتر باشد' } } } },
          401: { description: 'لازم است وارد شوید',     content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          500: { description: 'خطای سرور',                 content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/categories/requests': {
      get: {
        tags: ['دسته‌بندی‌ها'],
        summary: 'وضعیت درخواست‌های دسته‌بندی کاربر',
        description: 'لیست تمام درخواست‌های ثبت‌شده توسط کاربر فعلی (در انتظار، تایید شده، رد شده).',
        responses: {
          200: {
            description: 'لیست درخواست‌ها',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    requests: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id:          { type: 'integer', example: 7 },
                          name:        { type: 'string',  example: 'هزینه خودرو' },
                          icon:        { type: 'string',  example: '🚙' },
                          color:       { type: 'string',  example: '#1A5C3A' },
                          type:        { type: 'string',  example: 'expense' },
                          status:      { type: 'string',  enum: ['pending','approved','rejected'], example: 'pending' },
                          admin_note:  { type: 'string',  nullable: true, example: null },
                          created_at:  { type: 'string',  example: '2026-06-12 11:30:00' },
                          reviewed_at: { type: 'string',  nullable: true, example: null },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'لازم است وارد شوید', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          500: { description: 'خطای سرور',           content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/admin/categories/requests': {
      get: {
        tags: ['مدیریت دسته‌بندی‌ها (ادمین)'],
        summary: 'لیست همه‌ی درخواست‌های دسته‌بندی',
        description: 'بازگشت تمام درخواست‌ها به همراه مشخصات کاربر درخواست‌دهنده؛ ابتدا pending ها.',
        responses: {
          200: { description: 'لیست درخواست‌ها', content: { 'application/json': { schema: { type: 'object', properties: { requests: { type: 'array', items: { type: 'object' } } } } } } },
          401: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          500: { description: 'خطای سرور',       content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/admin/categories/requests/{id}': {
      patch: {
        tags: ['مدیریت دسته‌بندی‌ها (ادمین)'],
        summary: 'تایید یا رد درخواست دسته‌بندی',
        description: 'با action=approve یک دسته‌بندی سفارشی برای کاربر اضافه می‌شود و یک پیام به او ارسال می‌گردد. با action=reject تنها وضعیت به rejected تغییر می‌کند.',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action:     { type: 'string', enum: ['approve','reject'] },
                  admin_note: { type: 'string', nullable: true, example: 'تبریک — اضافه شد' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'انجام شد',           content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } } } } } },
          400: { description: 'مقادیر نامعتبر',     content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'درخواست یافت نشد',   content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'درخواست یافت نشد' } } } },
          409: { description: 'قبلاً پاسخ داده شده', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'این درخواست قبلاً تایید شده است' } } } },
          401: { description: 'دسترسی غیرمجاز',     content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          500: { description: 'خطای سرور',           content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/admin/categories/defaults': {
      get: {
        tags: ['مدیریت دسته‌بندی‌ها (ادمین)'],
        summary: 'لیست دسته‌بندی‌های پیش‌فرض',
        responses: {
          200: { description: 'categories', content: { 'application/json': { schema: { type: 'object', properties: { categories: { type: 'array', items: { type: 'object' } } } } } } },
          401: { description: 'session ادمین', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      post: {
        tags: ['مدیریت دسته‌بندی‌ها (ادمین)'],
        summary: 'افزودن دسته پیش‌فرض',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'color', 'type'],
                properties: {
                  name: { type: 'string', maxLength: 30 },
                  icon: { type: 'string', example: '🎯' },
                  color: { type: 'string', example: '#EF4444' },
                  type: { type: 'string', enum: ['expense', 'income', 'both'] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'ایجاد شد', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, id: { type: 'integer' } } } } } },
          400: { description: 'اعتبارسنجی', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'session ادمین', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/admin/categories/defaults/{id}': {
      patch: {
        tags: ['مدیریت دسته‌بندی‌ها (ادمین)'],
        summary: 'ویرایش دسته پیش‌فرض',
        description: 'نام، آیکون، رنگ و is_active — نوع (type) قابل تغییر نیست.',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  icon: { type: 'string' },
                  color: { type: 'string' },
                  is_active: { type: 'integer', enum: [0, 1] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'success', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' } } } } } },
          404: { description: 'یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'session ادمین', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/push/unsubscribe': {
      delete: {
        tags: ['پوش نوتیفیکیشن'],
        summary: 'لغو push subscription',
        description: 'حذف subscription از دیتابیس برای endpoint مشخص شده (تنها برای کاربر فعلی). معمولاً وقتی کاربر اطلاع‌رسانی را خاموش کند یا مرورگر به‌صورت خودکار subscription را لغو کند، فراخوانی می‌شود.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['endpoint'],
                properties: {
                  endpoint: { type: 'string', example: 'https://fcm.googleapis.com/fcm/send/abc...' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'حذف شد', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } } } } },
          400: { description: 'endpoint الزامی است', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'endpoint الزامی است' } } } },
          401: { description: 'لازم است وارد شوید', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
          500: { description: 'خطای سرور', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════
    //   فاز ۵ — تراکنش‌ها
    // ════════════════════════════════════════════════════════════════════
    '/api/transactions': {
      get: {
        tags: ['تراکنش‌ها'],
        summary: 'دریافت لیست تراکنش‌های کاربر',
        description:
          'لیست تراکنش‌های کاربر با پشتیبانی از صفحه‌بندی، فیلتر بر اساس نوع/دسته/تگ/بازه‌ی زمانی/ماه و جستجوی متنی. ' +
          'خروجی شامل خلاصه (مجموع درآمد، مجموع هزینه و مانده) برای همان scope فیلتر هم می‌باشد. ' +
          'مرتب‌سازی پیش‌فرض: ابتدا تاریخ تراکنش (نزولی) سپس created_at (نزولی).',
        parameters: [
          { name: 'page',        in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
          { name: 'limit',       in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
          { name: 'type',        in: 'query', schema: { type: 'string', enum: ['income', 'expense'] } },
          { name: 'category_id', in: 'query', schema: { type: 'integer' } },
          { name: 'tag',         in: 'query', schema: { type: 'string' }, description: 'فقط ردیف‌هایی که این تگ را دارند' },
          { name: 'date_from',   in: 'query', schema: { type: 'string', example: '2025-06-01' }, description: 'فرمت YYYY-MM-DD میلادی' },
          { name: 'date_to',     in: 'query', schema: { type: 'string', example: '2025-06-30' } },
          { name: 'month',       in: 'query', schema: { type: 'string', example: '2025-06' }, description: 'شورت‌کات فیلتر ماه (YYYY-MM)؛ اگر همراه با date_from/date_to ارسال شود، تنها month اعمال می‌شود.' },
          { name: 'search',      in: 'query', schema: { type: 'string' }, description: 'جستجو در عنوان و یادداشت' },
        ],
        responses: {
          200: {
            description: 'لیست تراکنش‌ها',
            content: {
              'application/json': {
                example: {
                  transactions: [
                    {
                      id: 12, type: 'expense', amount: 185000, currency: 'IRR',
                      category: { id: 1, name: 'خوراک و رستوران', icon: '🍽️', color: '#EF4444' },
                      title: 'ناهار رستوران', note: 'با همکاران',
                      tags: ['کاری'],
                      transaction_date: '2025-06-11', transaction_time: null,
                      is_recurring: false, recurring_interval: null,
                      created_at: '2025-06-11 09:00:00',
                    },
                  ],
                  pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
                  summary: { total_income: 0, total_expense: 185000, balance: -185000 },
                },
              },
            },
          },
          401: { description: 'لازم است وارد شوید', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
        },
      },
      post: {
        tags: ['تراکنش‌ها'],
        summary: 'ثبت تراکنش جدید',
        description:
          'یک تراکنش درآمد یا هزینه ثبت می‌کند. مبلغ همیشه به صورت عدد صحیح مثبت (تومان) ذخیره می‌شود. ' +
          'دسته‌بندی باید پیش‌فرض یا متعلق به کاربر (تایید‌شده) باشد و نوع آن (income/expense/both) با type تراکنش هماهنگ باشد. ' +
          'تگ‌ها به‌صورت آرایه ارسال می‌شوند، تا حداکثر ۵ تگ و هر تگ تا ۲۰ کاراکتر. ' +
          'transaction_date را می‌توان به صورت میلادی یا شمسی (YYYY-MM-DD) فرستاد؛ سرور به صورت خودکار تشخیص می‌دهد. ' +
          'برای تراکنش تکراری باید recurring_interval مشخص شود.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'amount', 'category_id', 'title', 'transaction_date'],
                properties: {
                  type:               { type: 'string', enum: ['income', 'expense'] },
                  amount:             { type: 'integer', minimum: 1, maximum: 999999999999 },
                  category_id:        { type: 'integer' },
                  title:              { type: 'string', maxLength: 60 },
                  note:               { type: 'string', maxLength: 500, nullable: true },
                  tags:               { type: 'array', items: { type: 'string', maxLength: 20 }, maxItems: 5 },
                  transaction_date:   { type: 'string', example: '2025-06-11' },
                  transaction_time:   { type: 'string', example: '14:30', nullable: true },
                  is_recurring:       { type: 'boolean', default: false },
                  recurring_interval: { type: 'string', enum: ['weekly', 'monthly', 'yearly'], nullable: true },
                },
              },
              example: {
                type: 'expense', amount: 185000, category_id: 1,
                title: 'ناهار رستوران', note: 'با همکاران',
                tags: ['کاری'], transaction_date: '2025-06-11',
                is_recurring: false,
              },
            },
          },
        },
        responses: {
          201: { description: 'تراکنش ثبت شد', content: { 'application/json': { example: { success: true, transaction: { id: 12 } } } } },
          400: { description: 'خطای ولیدیشن', content: { 'application/json': { example: { message: 'مبلغ باید بزرگ‌تر از صفر باشد', errors: [{ field: 'amount', message: 'مبلغ باید بزرگ‌تر از صفر باشد' }] } } } },
          422: { description: 'خطای ولیدیشن طول فیلد', content: { 'application/json': { example: { message: 'عنوان نمی‌تواند بیش از ۶۰ کاراکتر باشد' } } } },
          401: { description: 'لازم است وارد شوید', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/transactions/{id}': {
      get: {
        tags: ['تراکنش‌ها'],
        summary: 'دریافت جزئیات یک تراکنش',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'جزئیات تراکنش', content: { 'application/json': { example: { transaction: { id: 12, type: 'expense', amount: 185000 } } } } },
          403: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          404: { description: 'تراکنش یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'تراکنش یافت نشد' } } } },
        },
      },
      patch: {
        tags: ['تراکنش‌ها'],
        summary: 'ویرایش تراکنش (partial update)',
        description:
          'فقط فیلدهایی که تغییر کرده‌اند را ارسال کنید. usage_count تگ‌ها بر اساس diff ' +
          'افزوده/کاسته می‌شود. اگر is_recurring تغییر کند، رکورد recurring_alerts همگام‌سازی می‌شود.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { example: { amount: 200000, note: 'به‌روز شد', tags: ['کاری', 'غذا'] } } },
        },
        responses: {
          200: { description: 'به‌روزرسانی شد', content: { 'application/json': { example: { success: true, transaction: { id: 12, amount: 200000 } } } } },
          400: { description: 'خطای ولیدیشن', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          403: { description: 'دسترسی غیرمجاز', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'دسترسی غیرمجاز' } } } },
          404: { description: 'تراکنش یافت نشد', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' }, example: { message: 'تراکنش یافت نشد' } } } },
        },
      },
      delete: {
        tags: ['تراکنش‌ها'],
        summary: 'حذف تراکنش (نرم — soft delete)',
        description: 'تراکنش فیزیکی حذف نمی‌شود؛ تنها is_deleted=1 ست می‌شود و usage_count تگ‌ها کاهش می‌یابد.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'حذف شد', content: { 'application/json': { example: { success: true, message: 'تراکنش حذف شد' } } } },
          403: { description: 'دسترسی غیرمجاز' },
          404: { description: 'تراکنش یافت نشد' },
        },
      },
    },

    '/api/transactions/bulk-delete': {
      post: {
        tags: ['تراکنش‌ها'],
        summary: 'حذف چند تراکنش به صورت دسته‌ای',
        description: 'لیست شناسه‌ها را می‌گیرد و فقط آن‌هایی که متعلق به کاربر هستند را حذف نرم می‌کند. شناسه‌های نامعتبر/متعلق به دیگران در شمارش نهایی نمی‌آیند.',
        requestBody: {
          required: true,
          content: { 'application/json': { example: { ids: [12, 13, 14] } } },
        },
        responses: {
          200: { description: 'حذف انجام شد', content: { 'application/json': { example: { success: true, deleted_count: 3 } } } },
          400: { description: 'لیست خالی', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/transactions/import': {
      post: {
        tags: ['تراکنش‌ها'],
        summary: 'وارد کردن تراکنش‌ها از فایل CSV یا Excel',
        description:
          'فایل CSV یا Excel (xlsx/xls) با سرستون‌های فارسی را می‌پذیرد. حداکثر ۲ مگابایت. ' +
          'برای Excel، اولین شیت پردازش می‌شود. ' +
          'تاریخ‌ها به صورت شمسی YYYY-MM-DD نوشته می‌شوند و سرور به‌صورت خودکار به میلادی تبدیل می‌کند. ' +
          'اگر نام دسته‌بندی پیدا نشد، از دسته‌ی پیش‌فرض «متفرقه» استفاده می‌شود و در warnings برگشت داده می‌شود. ' +
          'ردیف‌های نامعتبر در errors لیست می‌شوند ولی هرگز باعث ۵۰۰ شدن کل درخواست نمی‌شوند.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'فایل CSV (UTF-8) یا Excel (xlsx/xls)، حداکثر ۲ مگابایت' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'پردازش انجام شد (با موفقیت یا با خطاهای ردیفی)',
            content: {
              'application/json': {
                example: {
                  success: true, imported: 4, failed: 1,
                  errors:  [{ row: 5, message: 'مبلغ نامعتبر' }],
                  warnings: [{ row: 6, message: 'دسته‌بندی یافت نشد — متفرقه استفاده شد' }],
                },
              },
            },
          },
          400: { description: 'فایل نامعتبر یا خالی', content: { 'application/json': { example: { message: 'فرمت فایل نامعتبر است — فقط CSV یا Excel پذیرفته می‌شود' } } } },
          413: { description: 'حجم فایل بیش از ۲ مگابایت', content: { 'application/json': { example: { message: 'حجم فایل بیش از ۲ مگابایت است' } } } },
        },
      },
    },

    '/api/transactions/sample-csv': {
      get: {
        tags: ['تراکنش‌ها'],
        summary: 'دانلود فایل نمونه CSV',
        description: 'فایل CSV با سرستون‌های فارسی و چند ردیف نمونه برای دانلود برمی‌گرداند. UTF-8 BOM در ابتدای فایل قرار داده می‌شود تا Excel سرستون‌های فارسی را درست باز کند.',
        responses: {
          200: {
            description: 'فایل CSV',
            content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } },
          },
        },
      },
    },

    '/api/transactions/tags': {
      get: {
        tags: ['تراکنش‌ها'],
        summary: 'دریافت تگ‌های کاربر (مرتب بر اساس usage_count)',
        responses: {
          200: {
            description: 'لیست تگ‌ها',
            content: { 'application/json': { example: { tags: [{ id: 1, name: 'کاری', color: '#6B7280', usage_count: 3 }] } } },
          },
        },
      },
    },

    '/api/transactions/summary': {
      get: {
        tags: ['تراکنش‌ها'],
        summary: 'خلاصه مالی ماهانه',
        description:
          'خلاصه مالی کاربر برای یک ماه: مجموع درآمد، مجموع هزینه، مانده، ۳ دسته‌ی برتر هزینه با درصد و ' +
          'تعداد تراکنش‌های تکراری ماه. همچنین تشخیص اشتراک‌های ماهانه به‌صورت recurring_subscriptions برمی‌گرداند.',
        parameters: [
          { name: 'month', in: 'query', schema: { type: 'string', example: '2025-06' }, description: 'فرمت YYYY-MM (پیش‌فرض: ماه جاری میلادی)' },
        ],
        responses: {
          200: {
            description: 'خلاصه',
            content: {
              'application/json': {
                example: {
                  month: '2025-06',
                  total_income: 15000000, total_expense: 4200000, balance: 10800000,
                  top_categories: [
                    { category_id: 1, category_name: 'خوراک و رستوران', category_icon: '🍽️', category_color: '#EF4444', total: 2200000, percentage: 52 },
                  ],
                  recurring_count: 3,
                  recurring_subscriptions: { count: 3, total_monthly: 450000, items: [{ title: 'نتفلیکس', amount: 120000, next_expected: '2025-07-11' }] },
                },
              },
            },
          },
        },
      },
    },

    '/api/transactions/recurring': {
      get: {
        tags: ['تراکنش‌ها'],
        summary: 'لیست تراکنش‌های تکراری کاربر',
        description: 'تمام تراکنش‌های با is_recurring=1 (و is_deleted=0) را همراه با next_expected (از جدول recurring_alerts) برمی‌گرداند.',
        responses: {
          200: {
            description: 'لیست تراکنش‌های تکراری',
            content: {
              'application/json': {
                example: {
                  recurring: [{
                    id: 12, title: 'اشتراک نتفلیکس', amount: 120000, type: 'expense',
                    category: { id: 8, name: 'اشتراک‌های دیجیتال', icon: '📱', color: '#6366F1' },
                    recurring_interval: 'monthly',
                    last_date: '2025-06-11', next_expected: '2025-07-11',
                  }],
                },
              },
            },
          },
        },
      },
    },

    '/api/budgets': {
      get: {
        tags: ['بودجه'],
        summary: 'دریافت بودجه‌های کاربر برای یک ماه',
        parameters: [{ name: 'month', in: 'query', schema: { type: 'string', example: '2025-06' }, description: 'YYYY-MM' }],
        responses: { 200: { description: 'لیست بودجه‌ها با spent/remaining/status' } },
      },
      post: {
        tags: ['بودجه'],
        summary: 'تنظیم بودجه برای یک دسته‌بندی',
        requestBody: {
          required: true,
          content: { 'application/json': { example: { category_id: 1, month: '2025-06', amount: 2000000 } } },
        },
        responses: {
          200: { description: 'بودجه ذخیره شد' },
          400: { description: 'مبلغ یا دسته نامعتبر', content: { 'application/json': { example: { message: 'مبلغ بودجه باید بزرگ‌تر از صفر باشد' } } } },
        },
      },
    },
    '/api/budgets/bulk': {
      post: {
        tags: ['بودجه'],
        summary: 'تنظیم چند بودجه همزمان',
        responses: { 200: { description: 'بودجه‌ها ذخیره شدند' } },
      },
    },
    '/api/budgets/zbb': {
      get: {
        tags: ['بودجه'],
        summary: 'وضعیت بودجه‌ریزی صفرمحور',
        responses: { 200: { description: 'total_income, total_budgeted, unassigned, is_zero_based' } },
      },
    },
    '/api/budgets/copy-from-last-month': {
      post: {
        tags: ['بودجه'],
        summary: 'کپی بودجه‌های ماه قبل',
        responses: {
          200: { description: 'کپی موفق' },
          404: { description: 'بودجه‌ای برای ماه قبل یافت نشد', content: { 'application/json': { example: { message: 'بودجه‌ای برای ماه قبل یافت نشد' } } } },
        },
      },
    },
    '/api/budgets/{id}': {
      delete: {
        tags: ['بودجه'],
        summary: 'حذف بودجه',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'حذف شد' }, 404: { description: 'یافت نشد' } },
      },
    },

    '/api/reports/monthly': {
      get: { tags: ['گزارشات'], summary: 'گزارش ماهانه', responses: { 200: { description: 'income/expense/balance/daily_totals' } } },
    },
    '/api/reports/comparison': {
      get: { tags: ['گزارشات'], summary: 'مقایسه ماه‌به‌ماه', responses: { 200: { description: 'comparison + trends' } } },
    },
    '/api/reports/weekly-pattern': {
      get: { tags: ['گزارشات'], summary: 'تحلیل الگوی خرج بر اساس روز هفته', responses: { 200: { description: 'days + peak_day_insight' } } },
    },
    '/api/reports/cash-flow-forecast': {
      get: { tags: ['گزارشات'], summary: 'پیش‌بینی جریان نقدی', responses: { 200: { description: 'projected_end_balance + confidence' } } },
    },
    '/api/reports/net-worth-snapshot': {
      get: { tags: ['گزارشات'], summary: 'تصویر لحظه‌ای خالص دارایی', responses: { 200: { description: 'monthly_snapshots' } } },
    },
    '/api/reports/subscription-tracker': {
      get: { tags: ['گزارشات'], summary: 'ردیابی اشتراک‌های ماهانه', responses: { 200: { description: 'subscriptions + total_monthly' } } },
    },
    '/api/reports/score': {
      get: {
        tags: ['امتیاز مالی'],
        summary: 'امتیاز مالی ماهانه',
        parameters: [{
          name: 'month',
          in: 'query',
          schema: { type: 'string', example: '2025-06' },
          description: 'ماه مورد نظر (YYYY-MM) — پیش‌فرض: ماه جاری',
        }],
        responses: { 200: { description: 'score 0-100 + breakdown + tips + label + color' } },
      },
    },
    '/api/reports/score/history': {
      get: {
        tags: ['امتیاز مالی'],
        summary: 'تاریخچه امتیاز مالی',
        parameters: [{
          name: 'months',
          in: 'query',
          schema: { type: 'integer', default: 6, maximum: 12 },
          description: 'تعداد ماه‌های گذشته (حداکثر ۱۲)',
        }],
        responses: {
          200: {
            description: 'history[] + best_month + avg_score + trend (up|down|stable)',
          },
        },
      },
    },
    '/api/reports/insights': {
      get: {
        tags: ['بینش‌های رفتاری'],
        summary: 'بینش‌های رفتاری مالی کاربر',
        parameters: [{
          name: 'months',
          in: 'query',
          schema: { type: 'integer', default: 3 },
          description: 'بازه تحلیل به ماه (پیش‌فرض ۳)',
        }],
        responses: {
          200: {
            description: 'insights[] (peak_day, category_trend, savings_rate, subscriptions, budget_adherence, logging_streak) + generated_at',
          },
        },
      },
    },
    '/api/reports/export/csv': {
      get: { tags: ['صادرکردن'], summary: 'خروجی CSV تراکنش‌ها', responses: { 200: { description: 'فایل CSV با تاریخ شمسی' } } },
    },
    '/api/reports/export/pdf': {
      get: { tags: ['صادرکردن'], summary: 'خروجی PDF گزارش ماهانه', responses: { 200: { description: 'فایل PDF' } } },
    },

    '/api/goals': {
      get: {
        tags: ['اهداف پس‌انداز'],
        summary: 'دریافت اهداف پس‌انداز کاربر',
        parameters: [{
          name: 'include_completed',
          in: 'query',
          schema: { type: 'boolean', default: false },
          description: 'نمایش اهداف تکمیل‌شده',
        }],
        responses: {
          200: { description: 'لیست اهداف با percentage، remaining، monthly_needed' },
          401: { description: 'نیاز به ورود', content: { 'application/json': { example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
        },
      },
      post: {
        tags: ['اهداف پس‌انداز'],
        summary: 'ایجاد هدف پس‌انداز جدید',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                title: 'لپتاپ جدید',
                target_amount: 50000000,
                icon: '💻',
                color: '#1A5C3A',
                deadline: '2026-09-15',
                initial_amount: 5000000,
              },
            },
          },
        },
        responses: {
          201: { description: 'هدف ایجاد شد' },
          400: { description: 'تاریخ نامعتبر', content: { 'application/json': { example: { message: 'تاریخ هدف باید در آینده باشد' } } } },
          422: { description: 'مبلغ نامعتبر', content: { 'application/json': { example: { message: 'مبلغ هدف باید بزرگ‌تر از صفر باشد' } } } },
        },
      },
    },
    '/api/goals/{id}': {
      patch: {
        tags: ['اهداف پس‌انداز'],
        summary: 'ویرایش هدف',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'هدف به‌روز شد' },
          403: { description: 'دسترسی غیرمجاز', content: { 'application/json': { example: { message: 'دسترسی غیرمجاز' } } } },
          404: { description: 'یافت نشد', content: { 'application/json': { example: { message: 'هدف یافت نشد' } } } },
        },
      },
      delete: {
        tags: ['اهداف پس‌انداز'],
        summary: 'حذف هدف',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'حذف شد' }, 404: { description: 'یافت نشد' } },
      },
    },
    '/api/goals/{id}/contribute': {
      post: {
        tags: ['اهداف پس‌انداز'],
        summary: 'افزودن مبلغ به هدف',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { example: { amount: 500000, note: 'پس‌انداز ماهانه' } } },
        },
        responses: {
          200: { description: 'واریز ثبت شد — در صورت تکمیل، پیام سیستمی ارسال می‌شود' },
          400: { description: 'مبلغ نامعتبر', content: { 'application/json': { example: { message: 'مبلغ باید بزرگ‌تر از صفر باشد' } } } },
          403: { description: 'دسترسی غیرمجاز' },
        },
      },
    },
    '/api/goals/{id}/withdraw': {
      post: {
        tags: ['اهداف پس‌انداز'],
        summary: 'برداشت مبلغ از هدف',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { example: { amount: 200000 } } },
        },
        responses: {
          200: { description: 'برداشت ثبت شد' },
          400: { description: 'موجودی ناکافی', content: { 'application/json': { example: { message: 'موجودی کافی برای برداشت وجود ندارد' } } } },
          403: { description: 'دسترسی غیرمجاز' },
        },
      },
    },
    '/api/goals/{id}/history': {
      get: {
        tags: ['اهداف پس‌انداز'],
        summary: 'تاریخچه واریز/برداشت یک هدف',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'contributions با amount مثبت (واریز) یا منفی (برداشت)' },
          404: { description: 'هدف یافت نشد' },
        },
      },
    },

    '/api/market/gold-currency': {
      get: {
        tags: ['نمای بازار'],
        summary: 'قیمت طلا، سکه و ارز',
        parameters: [{ name: 'force', in: 'query', schema: { type: 'boolean' }, description: 'بروزرسانی اجباری (حداکثر یک بار در دقیقه)' }],
        responses: {
          200: { description: 'items + cached + cache_age_minutes + group' },
          401: { description: 'نیاز به ورود' },
          503: { description: 'سرویس در دسترس نیست', content: { 'application/json': { example: { message: 'سرویس قیمت در حال حاضر در دسترس نیست' } } } },
        },
      },
    },
    '/api/market/crypto': {
      get: { tags: ['نمای بازار'], summary: 'قیمت ارزهای دیجیتال', responses: { 200: { description: 'price_usd, price_toman, market_cap' }, 503: { description: 'خطا' } } },
    },
    '/api/market/commodity': {
      get: { tags: ['نمای بازار'], summary: 'قیمت کامودیتی‌ها', responses: { 200: { description: 'section: precious|base|energy' }, 503: { description: 'خطا' } } },
    },
    '/api/market/all': {
      get: { tags: ['نمای بازار'], summary: 'همه داده‌های بازار', parameters: [{ name: 'force', in: 'query', schema: { type: 'boolean' } }], responses: { 200: { description: 'gold_currency, crypto, commodity, errors' } } },
    },
    '/api/market/favorites': {
      get: { tags: ['نمای بازار'], summary: 'علاقه‌مندی‌های کاربر', responses: { 200: { description: 'favorites[]' } } },
      post: {
        tags: ['نمای بازار'],
        summary: 'افزودن علاقه‌مندی',
        requestBody: { required: true, content: { 'application/json': { example: { symbol: 'IR_GOLD_18K', category: 'gold_currency' } } } },
        responses: { 200: { description: 'اضافه شد' }, 400: { description: 'دسته نامعتبر' } },
      },
    },
    '/api/market/favorites/{symbol}': {
      delete: {
        tags: ['نمای بازار'],
        summary: 'حذف علاقه‌مندی',
        parameters: [
          { name: 'symbol', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'category', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'حذف شد' }, 404: { description: 'یافت نشد' } },
      },
    },
    '/api/market/favorites/{symbol}/pin': {
      patch: {
        tags: ['نمای بازار'],
        summary: 'پین/آنپین',
        parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { example: { pinned: true, category: 'gold_currency' } } } },
        responses: { 200: { description: 'به‌روز شد' } },
      },
    },

    '/api/assets/types': {
      get: {
        tags: ['دارایی‌ها'],
        summary: 'لیست انواع دارایی قابل ثبت',
        description: 'لیست ثابت انواع دارایی با مشخصات market_symbol و has_market_price. نیاز به ورود دارد؛ اشتراک لازم نیست.',
        responses: {
          200: { description: 'types[]' },
          401: { description: 'نیاز به ورود' },
        },
      },
    },
    '/api/assets': {
      get: {
        tags: ['دارایی‌ها'],
        summary: 'دریافت دارایی‌های کاربر',
        description: 'محاسبه ارزش تومانی هر دارایی از کش بازار (Phase 8) یا قیمت دستی. snapshot روزانه در صورت گذشت ۲۴ ساعت.',
        responses: {
          200: { description: 'assets, total_value, by_risk, by_category' },
          403: { description: 'اشتراک فعال لازم', content: { 'application/json': { example: { message: 'این بخش مخصوص کاربران دارای اشتراک فعال است' } } } },
        },
      },
      post: {
        tags: ['دارایی‌ها'],
        summary: 'افزودن دارایی جدید',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                asset_key: 'gold_18k',
                quantity: 81.527,
                manual_price: null,
                custom_name: null,
                note: null,
                risk_level: 'medium',
              },
            },
          },
        },
        responses: {
          201: { description: 'asset با toman_value' },
          400: { description: 'نوع نامعتبر' },
          422: { description: 'قیمت الزامی' },
          403: { description: 'اشتراک فعال لازم' },
        },
      },
    },
    '/api/assets/history': {
      get: {
        tags: ['دارایی‌ها'],
        summary: 'تاریخچه ارزش کل دارایی‌ها',
        parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 30, maximum: 365 } }],
        responses: {
          200: { description: 'snapshots, change_7d, change_30d' },
          403: { description: 'اشتراک فعال لازم' },
        },
      },
    },
    '/api/assets/net-worth': {
      get: {
        tags: ['دارایی‌ها'],
        summary: 'خلاصه خالص دارایی‌ها',
        responses: {
          200: { description: 'total_assets, net_worth, trend' },
          403: { description: 'اشتراک فعال لازم' },
        },
      },
    },
    '/api/assets/{id}': {
      patch: {
        tags: ['دارایی‌ها'],
        summary: 'ویرایش دارایی',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'asset به‌روز' },
          404: { description: 'یافت نشد' },
          403: { description: 'دسترسی غیرمجاز' },
        },
      },
      delete: {
        tags: ['دارایی‌ها'],
        summary: 'حذف دارایی (soft delete)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'success' }, 404: { description: 'یافت نشد' } },
      },
    },

    '/api/expert/recommendations': {
      get: {
        tags: ['پیشنهاد تخصصی'],
        summary: 'دریافت پیشنهادات تخصصی',
        description: 'لیست پیشنهادات فعال با وضعیت per-user. مرتب‌سازی: urgent → high → medium → low.',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['all', 'pending', 'done', 'dismissed'], default: 'all' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['action', 'alert'] } },
          { name: 'only_active', in: 'query', schema: { type: 'boolean', default: true } },
        ],
        responses: {
          200: { description: 'recommendations + counts' },
          403: { description: 'اشتراک فعال لازم', content: { 'application/json': { example: { message: 'این بخش مخصوص کاربران دارای اشتراک فعال است' } } } },
        },
      },
    },
    '/api/expert/recommendations/{id}': {
      get: {
        tags: ['پیشنهاد تخصصی'],
        summary: 'جزئیات یک پیشنهاد',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'recommendation' }, 404: { description: 'یافت نشد' }, 403: { description: 'اشتراک' } },
      },
    },
    '/api/expert/recommendations/{id}/status': {
      patch: {
        tags: ['پیشنهاد تخصصی'],
        summary: 'به‌روزرسانی وضعیت پیشنهاد',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: { status: 'done' },
              schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['pending', 'done', 'dismissed'] } } },
            },
          },
        },
        responses: {
          200: { description: 'success + status' },
          400: { description: 'وضعیت نامعتبر' },
          404: { description: 'یافت نشد' },
          403: { description: 'اشتراک' },
        },
      },
    },

    '/api/admin/expert/recommendations': {
      get: {
        tags: ['مدیریت پیشنهادات (ادمین)'],
        summary: 'لیست پیشنهادات (ادمین)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['action', 'alert'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] } },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'recommendations + total + stats per row' }, 401: { description: 'ادمین' } },
      },
      post: {
        tags: ['مدیریت پیشنهادات (ادمین)'],
        summary: 'ایجاد پیشنهاد جدید',
        description: 'پس از INSERT، push و پیام in-app برای همه کاربران دارای اشتراک فعال (fire-and-forget).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                title: 'خرید طلای آب‌شده',
                body: 'با توجه به شرایط بازار…',
                type: 'action',
                asset_name: 'طلای آب‌شده',
                target_percent: 6.8,
                priority: 'high',
              },
            },
          },
        },
        responses: {
          201: { description: 'recommendation' },
          422: { description: 'اعتبارسنجی', content: { 'application/json': { example: { message: 'عنوان نمی‌تواند بیش از ۸۰ کاراکتر باشد' } } } },
        },
      },
    },

    '/api/admin/expert/send': {
      post: {
        tags: ['مدیریت پیشنهادات (ادمین)'],
        summary: 'ارسال پیشنهاد تخصصی به کاربران',
        description: 'ارسال مجدد پیشنهاد فعال به همه اشتراک‌داران یا یک کاربر مشخص. فقط کاربران با subscription_expires_at > now.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['target', 'recommendation_id'],
                properties: {
                  target: { type: 'string', enum: ['all_subscribed', 'user'] },
                  user_id: { type: 'integer' },
                  recommendation_id: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'success + sent_count + recommendation_title' },
          400: { description: 'پیشنهاد غیرفعال یا کاربر بدون اشتراک', content: { 'application/json': { examples: { inactive: { value: { message: 'این پیشنهاد غیرفعال است' } }, noSub: { value: { message: 'این کاربر اشتراک فعال ندارد' } } } } } },
          404: { description: 'پیشنهاد یا کاربر یافت نشد' },
        },
      },
    },

    '/api/admin/expert/stats/{recommendationId}': {
      get: {
        tags: ['مدیریت پیشنهادات (ادمین)'],
        summary: 'آمار یک پیشنهاد تخصصی',
        parameters: [{ name: 'recommendationId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'recommendation + stats (pending/done/dismissed %) + users_done[]' },
          404: { description: 'پیشنهاد یافت نشد' },
        },
      },
    },

    '/api/admin/expert/recommendations/subscriber-count': {
      get: {
        tags: ['مدیریت پیشنهادات (ادمین)'],
        summary: 'تعداد کاربران دارای اشتراک فعال',
        description: 'برای نمایش پیشرفت ارسال نوتیفیکیشن هنگام ایجاد پیشنهاد جدید.',
        responses: {
          200: { description: 'count', content: { 'application/json': { schema: { type: 'object', properties: { count: { type: 'integer' } } } } } },
          401: { description: 'session ادمین', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/admin/expert/recommendations/{id}/stats': {
      get: {
        tags: ['مدیریت پیشنهادات (ادمین)'],
        summary: 'آمار تفصیلی پیشنهاد',
        description: 'تعداد pending/done/dismissed و لیست کاربرانی که «انجام شد» ثبت کرده‌اند.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'stats + done_users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    stats: { type: 'object', properties: { pending: { type: 'integer' }, done: { type: 'integer' }, dismissed: { type: 'integer' } } },
                    done_users: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          404: { description: 'یافت نشد' },
          401: { description: 'session ادمین' },
        },
      },
    },

    '/api/admin/expert/recommendations/{id}': {
      patch: {
        tags: ['مدیریت پیشنهادات (ادمین)'],
        summary: 'ویرایش پیشنهاد',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'success' }, 404: { description: 'یافت نشد' } },
      },
      delete: {
        tags: ['مدیریت پیشنهادات (ادمین)'],
        summary: 'حذف پیشنهاد',
        description: 'حذف پیشنهاد + تمام user_recommendation_status مرتبط',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'success' }, 404: { description: 'یافت نشد' } },
      },
    },

    '/api/split/public/{token}': {
      get: {
        tags: ['دنگ و دونگ'],
        summary: 'اطلاعات عمومی گروه (بدون احراز هویت)',
        description: 'لینک shareable برای اعضای غیرثبت‌نام‌شده. با query mobile مانده شخصی برگردانده می‌شود.',
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' }, description: 'invite_token گروه' },
          { name: 'mobile', in: 'query', schema: { type: 'string', example: '09121234567' }, description: 'شماره موبایل عضو' },
        ],
        responses: {
          200: { description: 'group + personal (nullable) + cta' },
          404: { description: 'لینک نامعتبر', content: { 'application/json': { example: { message: 'لینک نامعتبر است' } } } },
        },
      },
    },
    '/api/split/groups': {
      get: {
        tags: ['دنگ و دونگ'],
        summary: 'لیست گروه‌های دنگ و دونگ کاربر',
        responses: { 200: { description: 'groups[] با member_count, total_expenses, my_balance' }, 401: { description: 'نیاز به ورود' } },
      },
      post: {
        tags: ['دنگ و دونگ'],
        summary: 'ایجاد گروه جدید',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: { name: 'سفر مشهد', description: 'هزینه‌های سفر', members: [{ display_name: 'علی', mobile: '09121111111' }] },
            },
          },
        },
        responses: {
          201: { description: 'group + share_url' },
          422: { description: 'نام بیش از ۶۰ کاراکتر', content: { 'application/json': { example: { message: 'نام گروه نمی‌تواند بیش از ۶۰ کاراکتر باشد' } } } },
        },
      },
    },
    '/api/split/groups/{id}': {
      get: {
        tags: ['دنگ و دونگ'],
        summary: 'جزئیات گروه',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'group + members + expenses + settlements + summary' },
          403: { description: 'عضو نیستید', content: { 'application/json': { example: { message: 'شما عضو این گروه نیستید' } } } },
          404: { description: 'گروه یافت نشد' },
        },
      },
    },
    '/api/split/groups/{id}/members': {
      post: {
        tags: ['دنگ و دونگ'],
        summary: 'افزودن عضو جدید',
        description: 'فقط سازنده گروه. اگر mobile در users باشد → is_registered=1',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { example: { display_name: 'سارا', mobile: '09122222222' } } },
        },
        responses: {
          200: { description: 'member' },
          409: { description: 'موبایل تکراری', content: { 'application/json': { example: { message: 'این شماره موبایل قبلاً در گروه است' } } } },
        },
      },
    },
    '/api/split/groups/{id}/members/{memberId}': {
      delete: {
        tags: ['دنگ و دونگ'],
        summary: 'حذف عضو از گروه',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'memberId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'success' },
          400: { description: 'بدهی تسویه‌نشده', content: { 'application/json': { example: { message: 'این عضو هنوز بدهی تسویه‌نشده دارد' } } } },
        },
      },
    },
    '/api/split/groups/{id}/expenses': {
      post: {
        tags: ['دنگ و دونگ'],
        summary: 'ثبت هزینه جدید',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                title: 'شام', amount: 600000, paid_by_member_id: 1,
                expense_date: '2025-06-12', split_type: 'equal',
              },
            },
          },
        },
        responses: {
          201: { description: 'expense + shares' },
          400: { description: 'مجموع سهم‌ها نامعتبر', content: { 'application/json': { example: { message: 'مجموع سهم‌ها باید برابر با مبلغ کل باشد' } } } },
        },
      },
    },
    '/api/split/groups/{id}/expenses/{expenseId}': {
      patch: {
        tags: ['دنگ و دونگ'],
        summary: 'ویرایش هزینه',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'expenseId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'success' }, 403: { description: 'دسترسی غیرمجاز' } },
      },
      delete: {
        tags: ['دنگ و دونگ'],
        summary: 'حذف هزینه (soft delete)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'expenseId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'success' } },
      },
    },
    '/api/split/groups/{id}/settle': {
      post: {
        tags: ['دنگ و دونگ'],
        summary: 'ثبت تسویه حساب',
        description: 'با create_transaction=true تراکنش expense برای کاربر logged-in (from_member) ثبت می‌شود.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                from_member_id: 2, to_member_id: 1, amount: 350000,
                create_transaction: true, transaction_date: '2025-06-12',
              },
            },
          },
        },
        responses: { 200: { description: 'settlement + transaction_id' } },
      },
    },
    '/api/split/lookup-mobile': {
      get: {
        tags: ['دنگ و دونگ'],
        summary: 'بررسی ثبت‌نام شماره موبایل',
        parameters: [{ name: 'mobile', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'registered + display_name یا registered:false' } },
      },
    },

    '/api/banners/active': {
      get: {
        tags: ['بنرهای تبلیغاتی'],
        summary: 'دریافت بنرهای فعال',
        description: 'بنرهایی که is_active=1 و در بازه زمانی فعلی هستند. impression_count به‌صورت non-blocking افزایش می‌یابد.',
        responses: {
          200: { description: 'banners[] — ممکن است خالی باشد' },
          401: { description: 'لطفاً وارد حساب کاربری خود شوید', content: { 'application/json': { example: { message: 'لطفاً وارد حساب کاربری خود شوید' } } } },
        },
      },
    },
    '/api/banners/{id}/click': {
      post: {
        tags: ['بنرهای تبلیغاتی'],
        summary: 'ثبت کلیک روی بنر',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'کلیک با موفقیت ثبت شد — success: true' } },
      },
    },

    '/api/admin/banners': {
      get: {
        tags: ['مدیریت بنرها (ادمین)'],
        summary: 'لیست بنرها (ادمین)',
        parameters: [{
          name: 'include_inactive',
          in: 'query',
          schema: { type: 'boolean', default: true },
        }],
        responses: { 200: { description: 'banners[] + status + ctr' }, 401: { description: 'دسترسی غیرمجاز' } },
      },
      post: {
        tags: ['مدیریت بنرها (ادمین)'],
        summary: 'آپلود بنر جدید (ادمین)',
        description: 'multipart/form-data — jpg/png/webp حداکثر ۳MB',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['image', 'title', 'link_url', 'starts_at', 'ends_at'],
                properties: {
                  image: { type: 'string', format: 'binary' },
                  title: { type: 'string', maxLength: 80 },
                  link_url: { type: 'string' },
                  link_type: { type: 'string', enum: ['external', 'internal'] },
                  starts_at: { type: 'string', example: '2025-06-01T00:00:00.000Z' },
                  ends_at: { type: 'string', example: '2025-07-01T23:59:59.000Z' },
                  display_order: { type: 'integer', default: 0 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'بنر با موفقیت آپلود شد' },
          400: { description: 'تاریخ یا فرمت نامعتبر' },
          401: { description: 'دسترسی غیرمجاز' },
          413: { description: 'حجم فایل بیش از ۳ مگابایت است' },
          500: { description: 'خطای سرور در آپلود فایل' },
        },
      },
    },
    '/api/admin/banners/stats': {
      get: {
        tags: ['مدیریت بنرها (ادمین)'],
        summary: 'آمار کلی بنرها (ادمین)',
        responses: { 200: { description: 'total_banners, active_now, overall_ctr, top_banner' } },
      },
    },
    '/api/admin/banners/{id}': {
      patch: {
        tags: ['مدیریت بنرها (ادمین)'],
        summary: 'ویرایش بنر (ادمین)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'banner به‌روز شد' }, 404: { description: 'بنر یافت نشد' } },
      },
      delete: {
        tags: ['مدیریت بنرها (ادمین)'],
        summary: 'حذف بنر (ادمین)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'success' }, 404: { description: 'بنر یافت نشد' } },
      },
    },

    '/api/admin/auth/login': {
      post: {
        tags: ['احراز هویت ادمین'],
        summary: 'ورود به پنل ادمین',
        description:
          'با نام کاربری و رمز عبور، session ادمین (`dakhlyar_admin_sid`) ایجاد می‌شود. اگر `must_change_password=1` باشد، پاسخ شامل `must_change: true` است.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'admin' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'ورود موفق',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    must_change: { type: 'boolean', example: false },
                    admin: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        username: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', enum: ['admin', 'superadmin'] },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'نام کاربری یا رمز عبور اشتباه است' },
          403: { description: 'حساب کاربری غیرفعال است' },
        },
      },
    },
    '/api/admin/auth/logout': {
      post: {
        tags: ['احراز هویت ادمین'],
        summary: 'خروج از پنل ادمین',
        description: 'session ادمین را destroy می‌کند و رویداد logout در `admin_activity_log` ثبت می‌شود.',
        responses: {
          200: { description: 'success: true' },
          401: { description: 'دسترسی غیرمجاز — لطفاً وارد پنل ادمین شوید' },
        },
      },
    },
    '/api/admin/auth/me': {
      get: {
        tags: ['احراز هویت ادمین'],
        summary: 'اطلاعات ادمین جاری',
        responses: {
          200: {
            description: 'admin: { id, username, email, role, last_login }',
          },
          401: { description: 'دسترسی غیرمجاز' },
        },
      },
    },
    '/api/admin/auth/change-password': {
      post: {
        tags: ['احراز هویت ادمین'],
        summary: 'تغییر رمز عبور ادمین',
        description:
          'اگر `must_change_password=1` باشد، `current_password` لازم نیست. رمز جدید: حداقل ۸ کاراکتر، یک حرف بزرگ، یک عدد، یک کاراکتر خاص.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['new_password', 'confirm_password'],
                properties: {
                  current_password: { type: 'string' },
                  new_password: { type: 'string', example: 'Admin@1234' },
                  confirm_password: { type: 'string', example: 'Admin@1234' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'رمز عبور با موفقیت تغییر یافت' },
          400: { description: 'رمز عبور و تکرار آن یکسان نیستند' },
          401: { description: 'رمز عبور فعلی اشتباه است' },
        },
      },
    },
    '/api/admin/admins': {
      get: {
        tags: ['مدیریت مدیران (ادمین)'],
        summary: 'لیست ادمین‌ها',
        description: 'فقط سوپر ادمین — password_hash هرگز برگردانده نمی‌شود.',
        responses: {
          200: { description: 'admins[]' },
          401: { description: 'دسترسی غیرمجاز' },
          403: { description: 'نیاز به سوپر ادمین' },
        },
      },
      post: {
        tags: ['مدیریت مدیران (ادمین)'],
        summary: 'افزودن ادمین جدید',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'superadmin'], default: 'admin' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'admin ایجاد شد' },
          409: { description: 'این نام کاربری قبلاً ثبت شده است' },
        },
      },
    },
    '/api/admin/admins/{id}': {
      patch: {
        tags: ['مدیریت مدیران (ادمین)'],
        summary: 'ویرایش ادمین',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'superadmin'] },
                  is_active: { type: 'boolean' },
                  must_change_password: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'success: true' },
          400: { description: 'نمی‌توانید حساب خود را غیرفعال کنید' },
        },
      },
      delete: {
        tags: ['مدیریت مدیران (ادمین)'],
        summary: 'حذف ادمین',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'success: true' },
          400: {
            description: 'نمی‌توانید حساب خود را حذف کنید / حداقل یک سوپر ادمین باید وجود داشته باشد',
          },
        },
      },
    },

    '/api/admin/stats/overview': {
      get: {
        tags: ['آمار و داشبورد ادمین'],
        summary: 'آمار کلی داشبورد ادمین',
        description: 'کاربران، احراز هویت، اشتراک، تراکنش، بنر و اهداف — از appDb + adminDb',
        responses: {
          200: { description: 'users, verification, subscriptions, transactions, banners, goals' },
          401: { description: 'دسترسی غیرمجاز' },
        },
      },
    },
    '/api/admin/stats/growth': {
      get: {
        tags: ['آمار و داشبورد ادمین'],
        summary: 'آمار رشد کاربران در ۶ ماه گذشته',
        responses: {
          200: { description: 'months[] با new_users, new_subscriptions, total_transactions' },
        },
      },
    },
    '/api/admin/stats/subscription-revenue': {
      get: {
        tags: ['آمار و داشبورد ادمین'],
        summary: 'درآمد اشتراک ماه به ماه',
        parameters: [{ name: 'months', in: 'query', schema: { type: 'integer', default: 6 } }],
        responses: {
          200: { description: 'months[], total_revenue_6m, avg_monthly_revenue' },
        },
      },
    },
    '/api/admin/stats/top-categories': {
      get: {
        tags: ['آمار و داشبورد ادمین'],
        summary: 'پرکاربردترین دسته‌بندی‌های تراکنش',
        responses: {
          200: { description: 'categories[] با transaction_count, total_amount, percentage' },
        },
      },
    },
    '/api/admin/activity-log': {
      get: {
        tags: ['آمار و داشبورد ادمین'],
        summary: 'لاگ فعالیت ادمین‌ها',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'admin_id', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'logs[], total, page, limit — admin_username نه ID' },
        },
      },
    },

    '/api/admin/users': {
      get: {
        tags: ['مدیریت کاربران (ادمین)'],
        summary: 'لیست کاربران',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'verification_level', in: 'query', schema: { type: 'integer', enum: [0, 1, 2, 3] } },
          { name: 'subscription_plan', in: 'query', schema: { type: 'string', enum: ['none', 'silver', 'gold', 'diamond'] } },
          { name: 'has_pending_verification', in: 'query', schema: { type: 'boolean' } },
          { name: 'has_pending_subscription', in: 'query', schema: { type: 'boolean' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'oldest', 'last_active'], default: 'newest' } },
        ],
        responses: { 200: { description: 'users[] + pagination' }, 401: { description: 'دسترسی غیرمجاز' } },
      },
    },
    '/api/admin/users/search': {
      get: {
        tags: ['مدیریت کاربران (ادمین)'],
        summary: 'جستجوی سریع کاربر با شماره موبایل',
        parameters: [{ name: 'mobile', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'users[]' } },
      },
    },
    '/api/admin/users/{id}': {
      get: {
        tags: ['مدیریت کاربران (ادمین)'],
        summary: 'جزئیات کامل یک کاربر',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'user, stats, verification_requests, subscription_requests, referrals, devices' }, 404: { description: 'کاربر یافت نشد' } },
      },
    },
    '/api/admin/users/{id}/reset-stories': {
      patch: {
        tags: ['مدیریت کاربران (ادمین)'],
        summary: 'ریست استوری برای یک کاربر',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'success: true' } },
      },
    },
    '/api/admin/users/reset-stories-all': {
      post: {
        tags: ['مدیریت کاربران (ادمین)'],
        summary: 'ریست استوری برای همه کاربران',
        responses: { 200: { description: 'success + updated_count' } },
      },
    },
    '/api/admin/verification/requests': {
      get: {
        tags: ['مدیریت کاربران (ادمین)'],
        summary: 'لیست درخواست‌های احراز هویت',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected', 'all'], default: 'pending' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'requests[] + pagination' } },
      },
    },
    '/api/admin/verification/requests/{id}': {
      patch: {
        tags: ['مدیریت کاربران (ادمین)'],
        summary: 'تایید یا رد درخواست احراز هویت',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: { type: 'string', enum: ['approve', 'reject'] },
                  admin_note: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'success: true' },
          400: { description: 'این درخواست قبلاً بررسی شده است' },
          404: { description: 'درخواست یافت نشد' },
        },
      },
    },
    '/api/admin/subscription/requests': {
      get: {
        tags: ['مدیریت کاربران (ادمین)'],
        summary: 'لیست درخواست‌های اشتراک',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected', 'all'], default: 'pending' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'requests[] + pagination' } },
      },
    },
    '/api/admin/subscription/requests/{id}': {
      patch: {
        tags: ['مدیریت کاربران (ادمین)'],
        summary: 'تایید یا رد درخواست اشتراک',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: { type: 'string', enum: ['approve', 'reject'] },
                  admin_note: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'success: true' },
          400: { description: 'این درخواست قبلاً بررسی شده است' },
        },
      },
    },
  },
};

const options = {
  definition,
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
