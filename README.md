# TradeKit — Binance USDT-M Futures / EMA20–50–100

Website tĩnh tiếng Việt bằng HTML/CSS/JavaScript thuần, dùng trên máy tính và điện thoại. Không cần framework, bước build, API key hay tài khoản Binance. Chỉ hỗ trợ quan sát; không gửi lệnh. Mặc định mở **SOLUSDT**, khung **M30**. Chỉ có ba khung lựa chọn: **M15 (15 phút), M30 (30 phút), H1 (1 giờ)**.

## Chạy

```sh
python3 -m http.server 8080
```

Mở http://localhost:8080. Tải lại trang nếu trình duyệt còn giữ phiên bản cũ. Có thể đưa `index.html` và thư mục `src/` lên hosting tĩnh HTTPS. Mạng/trình duyệt của người dùng phải được phép truy cập Binance.

## Giao diện tinh gọn

Thanh chọn coin và M15/M30/H1 ở đầu trang, mặc định SOLUSDT/M30. Màn hình chính tập trung vào biểu đồ, giá đóng, ba EMA và tín hiệu kèm kết quả đối chiếu. Trên điện thoại, tín hiệu nằm trước biểu đồ. Thẻ tín hiệu hiển thị tỷ lệ Long/Short/Chưa rõ trên tổng 36 góc nhìn gồm 30 phương pháp và 6 mục EMA; đây là phân bổ hướng, không phải xác suất thắng và không đổi kết luận EMA. Các phương pháp được chia thành 5 cụm, trong đó cụm **Mô hình 3-EMA** chứa 8 mẫu hình từ tài liệu người dùng. Mỗi ô chỉ hiện `Xu hướng tăng`, `Xu hướng giảm` hoặc `Chưa rõ`; ATR luôn `Chưa rõ` vì không chỉ hướng.

Khối **Đồng thuận 3 khung** dùng M15, M30 và H1 đã đóng. Một khung chỉ có hướng khi EMA20–50–100/độ dốc của khung đó cùng phía với đa số 30 phương pháp. Kết quả chung cần ít nhất 2/3 khung cùng hướng; 3/3 được ghi rõ. Đây chỉ là bộ lọc bổ trợ và không thay thế điều kiện xác nhận EMA/khung lớn của tín hiệu chính.

## Cấu trúc thư mục

```text
TradeKit/
├── index.html              # Điểm khởi đầu ứng dụng (Entry point HTML)
├── README.md               # Hướng dẫn tổng quan & quy tắc hệ thống
├── .gitignore              # Loại bỏ file rác, cache và test outputs
│
├── src/                    # Toàn bộ mã nguồn ứng dụng
│   ├── css/
│   │   └── style.css       # Giao diện responsive, theme và kiểu dáng
│   └── js/
│       ├── core.js         # Thuật toán EMA, kiểm tra/loại nến mở, quy tắc tín hiệu thuần
│       ├── api.js          # API Futures công khai, timeout, cache, giới hạn yêu cầu
│       ├── methods.js      # 30 phương pháp kỹ thuật, phân thành 5 cụm
│       └── app.js          # Kết nối dữ liệu với giao diện, biểu đồ SVG, làm mới, lưu trữ
│
├── docs/                   # Tài liệu kỹ thuật chi tiết
│   └── ANALYSIS.md         # Công thức, seed, tài liệu tham khảo và giới hạn 30 phương pháp
│
└── tests/                  # Bộ kiểm thử mô phỏng và kiểm tra kết nối
    ├── index.html          # Test runner kiểm thử mô phỏng trên trình duyệt
    ├── unit.js             # 48 ca kiểm thử thuật toán và API client thuần
    ├── browser.py          # Kiểm thử trình duyệt tự động qua Playwright
    └── live_api.py         # Kiểm tra kết nối trực tiếp đến Binance Futures API
```

## Nguồn dữ liệu và tài liệu chính thức

Đã đối chiếu [Binance Futures Market Data](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data) trước khi triển khai. Các trang cũ hiện chuyển hướng về trang tổng hợp này. Từng mục: Exchange Information, Check Server Time, Kline/Candlestick Data, Symbol Price Ticker V2, Mark Price.

Chỉ gọi `https://fapi.binance.com` bằng GET công khai:

| Endpoint | Vai trò |
| --- | --- |
| `/fapi/v1/exchangeInfo` | Kiểm tra symbol: `contractType=PERPETUAL`, `status=TRADING`, `quoteAsset=USDT`, `marginAsset=USDT` |
| `/fapi/v1/time` | Mốc thời gian Binance để xác định nến đóng; không dùng trường serverTime trong exchangeInfo |
| `/fapi/v1/klines?symbol=…&interval=…&limit=501` | Nến **giao dịch**, tính EMA từ Close; tải 15m, 30m, 1h và 4h; 4h chỉ đối chiếu |
| `/fapi/v2/ticker/price?symbol=…` | Giá giao dịch gần nhất, kèm thời gian giao dịch |
| `/fapi/v1/premiumIndex?symbol=…` | Mark Price, kèm thời gian máy chủ của giá này |

Ba loại giá được ghi nhãn riêng. Không thay giá đóng bằng Mark Price hoặc ticker. Không gọi Spot, testnet hoặc nguồn thay thế khi lỗi. Lỗi 403/451 hay mạng/CORS được báo rõ; ứng dụng không có chế độ giả lập dữ liệu thị trường.

## Công thức và làm ấm

Với chu kỳ N, `α = 2 / (N+1)`:

```text
EMA tại nến N = tổng N giá đóng đầu tiên / N
EMA(t) = α × Close(t) + (1−α) × EMA(t−1)
```

Trước nến N, EMA chưa có giá trị (`null`). Áp dụng cùng cách khởi tạo cho EMA20, EMA50 và EMA100. Mỗi khung phải có ít nhất **500 nến đã đóng liên tục**, nên EMA100 đã có ít nhất 400 bước cập nhật sau khởi tạo. Tải 501 nến để có 500 nến đóng khi có một nến đang mở. Coin mới niêm yết chưa đủ dữ liệu sẽ báo thiếu; không giảm yêu cầu làm ấm.

Lọc `closeTime < Binance serverTime` trước khi tính chỉ báo. Nến có closeTime bằng mốc máy chủ cũng chưa được công nhận. Kiểm tra số hữu hạn, OHLC hợp lệ, volume không âm, mốc thời gian đúng khung, nến liên tục, không trùng và có đúng nến đóng gần nhất theo mốc máy chủ. Mốc thời gian lấy trước khi tải nến: nếu quá trình tải đi qua biên khung, vẫn chỉ dùng nến đã đóng tại mốc đó, theo hướng thận trọng.

MACD bổ sung = EMA12 − EMA26; đường tín hiệu = EMA9 của các giá trị MACD hợp lệ; histogram = MACD − đường tín hiệu. Volume bổ sung = volume nến cuối / trung bình 20 nến **trước** nến cuối; nếu mẫu số 0 thì không tính tỷ số. Hai mục này không quyết định tín hiệu.

## Quy tắc tín hiệu

Tại nến đóng gần nhất t:

| Điều kiện | Long | Short |
| --- | --- | --- |
| Thứ tự | EMA20 > EMA50 > EMA100 | EMA20 < EMA50 < EMA100 |
| Độ dốc | Cả ba EMA(t) > EMA(t−3) | Cả ba EMA(t) < EMA(t−3) |
| Hồi | Có nến j trong t−5…t−1 giao vùng EMA20–50 tại j | Giống Long |
| Nến xác nhận | Close(t) > Open(t) và Close(t) > EMA20(t) | Close(t) < Open(t) và Close(t) < EMA20(t) |
| Khung lớn | Cùng hướng theo thứ tự **và** độ dốc | Cùng hướng theo thứ tự **và** độ dốc |

Giao vùng nghĩa là `High(j) >= min(EMA20(j), EMA50(j))` và `Low(j) <= max(EMA20(j), EMA50(j))`. Chạm bằng biên được tính. Lần hồi tại t tự nó không xác nhận tại t. Không thêm điều kiện giá đóng nến trước phải ở bên kia EMA20: hồi bằng râu nến vẫn hợp lệ theo định nghĩa high–low. Doji không xác nhận; EMA bằng nhau hoặc độ dốc bằng 0 không hợp lệ cho phía tương ứng. Thứ tự và độ dốc được kiểm tra lại tại t.

Đối chiếu **M15 → H1, M30 → H1, H1 → H4**. Khung lớn dùng nến đã đóng gần nhất tại cùng mốc Binance; không dùng nến lớn chưa đóng. Không cần khung lớn có mẫu hồi/xác nhận riêng. **H4 chỉ dùng xác nhận xu hướng cho H1**, không phải khung giao dịch được chọn. Không tải D1 trong luồng phân tích hiện tại.

Các trạng thái:

- **Chưa có xu hướng rõ**: thứ tự EMA và độ dốc chưa đồng hướng.
- **Có xu hướng — chờ hồi**: xu hướng hợp lệ, chưa có lần hồi trong cửa sổ.
- **Đã hồi — chờ nến xác nhận**: có hồi nhưng chưa có nến đúng màu đóng vượt EMA20; lần chạm tại t được ghi nhận để chờ nến sau.
- **Có xác nhận Long/Short**: chỉ nến đóng gần nhất t đủ tất cả điều kiện, gồm khung lớn hơn.
- Đồng thuận khung lớn vẫn là điều kiện nội bộ để xác nhận EMA, nhưng thông báo kỹ thuật dài không còn được đưa lên tiêu đề. Thẻ chính chỉ hiển thị `Xu hướng tăng`, `Xu hướng giảm`, `Chưa có xu hướng rõ` hoặc `Chờ dữ liệu`.

Xác nhận chỉ mô tả nến t, không được mang sang nến kế tiếp nếu nến kế tiếp không thỏa quy tắc. Kịch bản giá dùng **giá đóng nến gần nhất làm mức tham chiếu**, không phải giá khớp lệnh. Lịch sử là nhật ký thời điểm quan sát, không phải danh sách tín hiệu hiện tại; không quét ngược tạo tín hiệu cũ thành mới.

## Phương pháp bổ sung

Đã tính 22 chỉ báo nền cùng 8 mô hình mới: **EMA100 Breakout & Retest, HTF Rejection, EMA Squeeze, Hidden Divergence, EMA 2B Sweep, Rubber Band, EMA50 Double Test và Trend Surfing**. P1 Value Zone Pullback trong tài liệu trùng logic EMA chính nên không đếm lặp. Giao diện giữ đủ 30 phương pháp trong 5 khối và quy về ba trạng thái tăng/giảm/chưa rõ. Không thêm request API vì lớp đa khung tái sử dụng dữ liệu vốn đã tải.

Thẻ tín hiệu không còn hiển thị lỗi “khung thời gian trái chiều” hay mục đối chiếu khung lớn. Khi hướng EMA rõ, giao diện thay bằng **Kịch bản giá tham khảo**: giá đóng làm mốc, mức vô hiệu tại `min(Low 4 nến, EMA50) − 0,5×ATR` cho hướng tăng (đối xứng cho hướng giảm), TP1 tại 1,3R và TP2 tại 2,2R. Đây là mức kỹ thuật để quan sát, không phải lệnh, giá khớp, position sizing hay cam kết lợi nhuận.

Không triển khai position sizing, đòn bẩy 10x, pyramiding, webhook hoặc Telegram trong tài liệu nguồn. Chúng nằm ngoài phạm vi công cụ hỗ trợ phân tích và chưa có kiểm định hiệu quả.

Các phương pháp dùng cùng nến đã đóng, không cộng điểm hoặc thay đổi xác nhận EMA. Xem [ANALYSIS.md](docs/ANALYSIS.md) để đọc đầy đủ công thức và các tài liệu TradingView chính thức đã đối chiếu.

## Độ ổn định và lưu trữ

- Tối đa 3 HTTP request đang chạy; yêu cầu trùng cùng URL dùng chung promise.
- Cache nến và giá 15 giây; exchangeInfo 5 phút; thời gian máy chủ không cache qua lần tải. Cache tối đa 80 URL trong RAM.
- Timeout 12 giây/yêu cầu; không retry trong một lần tải. HTTP 429/418 tạm dừng toàn bộ yêu cầu ít nhất 60 giây, tôn trọng Retry-After dài hơn; hàng đợi còn lại cũng bị chặn.
- Mỗi thao tác đổi coin/khung/làm mới nhận một phiên mới. Phản hồi phiên cũ bị bỏ qua cả khi thành công/lỗi; dữ liệu cũ bị xóa ngay lúc bắt đầu thao tác mới. Request cũ có thể hoàn thành để chia sẻ cache, nhưng không được cập nhật UI/lịch sử.
- Tự tải mỗi 60 giây khi trang hiển thị và không có lần tải hiện hành. Khi quay lại tab, tải lại ngay. Bản tải quá 3 phút bị xóa khỏi kết luận; nến thiếu mốc đóng gần nhất bị từ chối. Ticker/Mark Price quá 3 phút hoặc thời gian bất thường được ghi thiếu/cũ riêng.
- Một khung phụ lỗi không làm mất biểu đồ khung chính; khung đối chiếu bắt buộc lỗi thì không xác nhận. Giá ticker/Mark lỗi không được thay bằng close, và không làm thay đổi EMA.
- Giữ watchlist hiện có tại `cl-watch`; thêm/xóa coin, tối đa 12. Coin được thêm sau khi đã kiểm tra exchangeInfo và tải hợp lệ. Mục theo dõi cũ vẫn phải được xác thực mỗi lần phân tích.
- Nhật ký mới tại `cl-futures-ema-v2-history`, tối đa 20 mục. Không đọc/ghi đè/xóa nhật ký Spot tại `cl-history`. Lưu localStorage từng trình duyệt, không đồng bộ thiết bị. Khi lưu bị chặn/đầy, báo lỗi và vẫn dùng RAM trong phiên.
- Giao diện chỉ giữ lịch sử dưới dạng mục thu gọn. Các khối “Xu hướng đa khung”, “Khối lượng” và “Công thức & quy tắc” riêng đã được bỏ vì kết quả khung lớn đã nằm trong thẻ tín hiệu, volume không quyết định tín hiệu, còn công thức đầy đủ nằm trong tài liệu này và `docs/ANALYSIS.md`.

## Kiểm tra lại

Kiểm thử công thức/quy tắc không cần Binance: chạy web server, mở http://localhost:8080/tests/ và xem toàn bộ kết quả. Fixture không được nạp trong trang sản phẩm.

Kiểm tra HTTP Binance thật (Python chuẩn):

```sh
python3 tests/live_api.py
```

Kiểm tra tự động trình duyệt Chromium (Playwright chỉ là công cụ QA, website không phụ thuộc):

```sh
python3 -m venv /tmp/tradekit-qa-env
/tmp/tradekit-qa-env/bin/pip install playwright
/tmp/tradekit-qa-env/bin/python -m playwright install chromium
# Để web server chạy ở terminal khác trên cổng 8080
/tmp/tradekit-qa-env/bin/python tests/browser.py
```

Script chạy hai giai đoạn riêng: truy cập Binance thật qua trình duyệt trước; sau đó chặn request trong context kiểm thử mới để trả dữ liệu mô phỏng. Kết quả, ảnh chụp màn hình và phản hồi khi chạy sẽ được tự động xuất ra thư mục `qa/` (thư mục này được loại trừ khỏi Git).

## Giới hạn

Kết nối phụ thuộc Binance, mạng, CORS và chính sách khu vực. Kết quả kiểm tra chỉ chứng minh môi trường/thời điểm ghi trong báo cáo, không đảm bảo nơi khác truy cập được. Việc chuyển ứng dụng sang hosting không tự vượt giới hạn Binance.

EMA phụ thuộc nguồn lịch sử và cách khởi tạo; số liệu có thể chênh nhẹ so với biểu đồ dùng lịch sử dài hơn. Không có backtest, xác suất thắng, đòn bẩy khuyến nghị, dự báo lợi nhuận hoặc điểm “dự án thật/ảo”. Chưa chứng minh hiệu quả chiến lược. Không kết nối tài khoản, không tự động giao dịch. Kiểm thử responsive dùng Chromium với kích thước viewport, chưa thay thế thử nghiệm trên thiết bị iOS/Android thật.

Theo yêu cầu, các lần cập nhật chỉ sửa mã nguồn/tài liệu; không tự động tạo hoặc cập nhật file ZIP.
