# Các phương pháp phân tích bổ sung

Bổ sung 12 phương pháp trên cùng **nến giao dịch Futures đã đóng** của khung đang xem. Mặc định SOLUSDT/M30; khung chọn M15, M30, H1. Không thêm nguồn dữ liệu hoặc request API. Các phương pháp không thay đổi `CoinCore.evaluate`, không cộng điểm và không tạo lệnh hay xác suất thắng. Giao diện luôn giữ đủ 12 phương pháp và chỉ hiện `Xu hướng tăng`, `Xu hướng giảm` hoặc `Chưa rõ`; ATR và trạng thái trung tính dùng `Chưa rõ` vì không cung cấp hướng.

## Mục đích và tài liệu đối chiếu

| Phương pháp | Câu hỏi cần đọc | Nguồn của nhà cung cấp chỉ báo |
| --- | --- | --- |
| RSI14 | Động lượng giá đóng đang nghiêng về phía nào? | [TradingView RSI](https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/) |
| ADX14 / ±DI14 | Xu hướng có độ mạnh không; chuyển động phía nào trội hơn? | [TradingView ADX](https://www.tradingview.com/support/solutions/43000589099-average-directional-index-adx/) |
| Bollinger20, 2σ | Giá đang ở đâu so với dải biến động? | [TradingView Bollinger Bands](https://www.tradingview.com/support/solutions/43000501840-bollinger-bands-bb/) |
| Donchian20 | Giá đóng có vượt đỉnh/đáy của 20 nến trước không? | [TradingView Donchian Channels](https://www.tradingview.com/support/solutions/43000502253-donchian-channels-dc/) |
| VWAP ngày UTC | Giá đóng so với giá trung bình theo khối lượng trong ngày? | [TradingView VWAP](https://www.tradingview.com/support/solutions/43000502018-volume-weighted-average-price-vwap/) |
| ATR14 | Biên độ biến động đang mở rộng hay thu hẹp? | [TradingView ATR](https://www.tradingview.com/support/solutions/43000501823-average-true-range-atr/) |
| Supertrend10×3 | Giá đóng đang ở phía nào của dải xu hướng ATR? | [TradingView Supertrend](https://www.tradingview.com/support/solutions/43000634738-supertrend/) |
| Ichimoku 9–26–52 | Giá và cấu trúc mây có cùng hướng không? | [TradingView Ichimoku](https://www.tradingview.com/support/solutions/43000589152-ichimoku-cloud/) |
| Stochastic 14–3–3 | Động lượng vùng biên đang quay theo hướng nào? | [TradingView Stochastic](https://www.tradingview.com/support/solutions/43000502332-stochastic-stoch/) |
| CCI20 | CCI cực trị đang quay lên hay quay xuống? | [TradingView CCI](https://www.tradingview.com/support/solutions/43000502001-commodity-channel-index-cci/) |
| MACD 12–26–9 | MACD đang trên hay dưới đường tín hiệu? | [TradingView Technical Ratings](https://www.tradingview.com/support/solutions/43000614331-technical-ratings/) |
| Momentum10 | Momentum hiện tại tăng hay giảm so với nến trước? | [TradingView Technical Ratings](https://www.tradingview.com/support/solutions/43000614331-technical-ratings/) |

Đã đọc và đối chiếu các tài liệu trên ngày 05/11/2026. Đây là tài liệu về công thức/cách đọc chỉ báo, không phải bằng chứng hiệu quả trên SOL Futures. Phần mã triển khai độc lập; không sao chép bộ chấm điểm hoặc chiến lược của nguồn.

## Khởi tạo Wilder

`RMA_N` khởi tạo bằng trung bình cộng N mẫu hợp lệ liên tiếp, sau đó:

```text
RMA(t) = [RMA(t−1) × (N−1) + x(t)] / N
```

Giá trị trước khi đủ mẫu là `null`. Mẫu khuyết ngắt chuỗi khởi tạo. Vẫn yêu cầu ít nhất 500 nến đã đóng từ luồng dữ liệu chính. Các cách seed có thể khác giữa nền tảng; các quy ước dưới đây là cách dùng của TradeKit.

## 1. RSI14 — động lượng

```text
Gain(t) = max(Close(t) − Close(t−1), 0)
Loss(t) = max(Close(t−1) − Close(t), 0)
RS = RMA14(Gain) / RMA14(Loss)
RSI = 100 − 100 / (1 + RS)
```

Bắt đầu từ biến động giữa hai nến; RSI đầu tại chỉ số 14 nếu nến đầu có chỉ số 0. Chỉ tăng → 100, chỉ giảm → 0. Cả trung bình lãi/lỗ bằng 0 → **quy ước 50**.

Nhãn: RSI ≥70 quá mua, ≤30 quá bán; giữa hai vùng, >50 động lượng tăng, <50 động lượng giảm, =50 cân bằng. Hướng đối chiếu EMA dựa trên vị trí so mốc 50, **không đảo hướng chỉ vì quá mua/quá bán**. Không tự phát hiện phân kỳ hoặc dự báo đảo chiều.

## 2. ADX14 / DMI14 — độ mạnh và chuyển động

```text
Up = High(t) − High(t−1)
Down = Low(t−1) − Low(t)
+DM = Up nếu Up > 0 và Up > Down, ngược lại 0
−DM = Down nếu Down > 0 và Down > Up, ngược lại 0
TR = max(H−L, |H−Close(t−1)|, |L−Close(t−1)|)
+DI = 100 × RMA14(+DM) / RMA14(TR)
−DI = 100 × RMA14(−DM) / RMA14(TR)
DX = 100 × |+DI − −DI| / (+DI + −DI)
ADX = RMA14(DX)
```

DMI bắt đầu từ nến thứ hai: ±DI đầu tại chỉ số 14, ADX đầu tại chỉ số 27. Khi Up = Down thì cả hai DM = 0. Mẫu số bằng 0 → DI hoặc DX tương ứng bằng 0.

ADX <20: yếu; 20–<25: chuyển tiếp; ≥25: có độ mạnh. ADX không chỉ hướng; so ±DI để đọc phía trội hơn. Chỉ ghi cùng/trái hướng EMA khi ADX ≥25 và DI không bằng nhau. Dưới ngưỡng vẫn hiển thị hai DI nhưng không biến chúng thành xác nhận.

## 3. Bollinger20 ± 2σ — vị trí và độ rộng

```text
Middle = trung bình 20 Close, gồm nến t
σ = sqrt[Σ(Close − Middle)² / 20]
Upper = Middle + 2σ
Lower = Middle − 2σ
Width% = (Upper − Lower) / |Middle| × 100
%B = (Close − Lower) / (Upper − Lower)
```

Dùng độ lệch chuẩn tổng thể chia N, không chia N−1. Đọc đóng trên/dưới dải hoặc trong dải. Đối chiếu hướng theo Close so Middle. Khi hai dải trùng, %B không xác định và hiển thị `—`; không chia cho 0. Giá chạm/đóng ngoài dải không phải tự động đảo chiều. Chưa tự gắn nhãn squeeze hay áp dụng ngưỡng squeeze tùy ý.

## 4. Donchian20 — kênh tham chiếu và phá vỡ

```text
Upper(t) = max(High[t−20…t−1])
Lower(t) = min(Low[t−20…t−1])
Middle = (Upper + Lower) / 2
```

Đây là biến thể **dịch một nến** để kiểm tra breakout: loại nến t khỏi vùng so sánh. Close(t) > Upper → đóng phá đỉnh; Close(t) < Lower → đóng phá đáy. Chạm bằng hoặc chỉ râu xuyên vùng chưa được tính. Trong kênh thì không suy ra hướng.

Chỉ xét nến đóng mới nhất, không giữ trạng thái phá vỡ của nến cũ. Đây là đỉnh/đáy cửa sổ trượt, không phải pivot được xác nhận, phân tích cấu trúc BOS/CHOCH, hay vùng hỗ trợ chắc chắn. Không dùng nến tương lai.

## 5. VWAP ngày UTC — vị trí theo khối lượng

```text
TypicalPrice = (High + Low + Close) / 3
VWAP = Σ(TypicalPrice × Volume) / ΣVolume
```

Volume là volume tài sản cơ sở của nến giao dịch. Anchor đặt lại mỗi **00:00 UTC**, tương ứng 07:00 Việt Nam. Dùng các nến đã đóng trong ngày chứa nến đóng cuối, không dùng thời gian giao dịch gần nhất để cộng nến mở.

- Close > VWAP: đóng trên; < VWAP: đóng dưới; bằng: tại VWAP.
- Nếu lịch sử bắt đầu giữa ngày thì toàn bộ phiên đầu bị bỏ, không trình bày VWAP thiếu đầu phiên như đủ phiên.
- Tổng volume bằng 0 → `null`. Nến volume 0 không làm thay đổi mức đã có.
- Hiển thị số nến trong phiên để nhận ra đầu ngày có ít mẫu.
- Khi vẽ, tách đường tại mỗi ngày UTC và tại giá trị khuyết, không nối qua ngày mới.

Đây là **xấp xỉ từ HLC3 và volume nến**, không phải VWAP tổng hợp từng giao dịch. Giá trị có thể khác giữa M15/M30/H1 do cách gom nến. Không thêm API trade/tick hoặc gọi Mark Price thay thế.

## 6. ATR14 — biến động, không phải hướng

TR theo công thức ở DMI; riêng TR của nến đầu lấy High−Low vì không có Close trước. ATR = RMA14(TR), có giá trị đầu tại chỉ số 13. `ATR% = ATR/Close ×100`.

So ATR hiện tại với **trung bình 20 giá trị ATR trước**, loại nến hiện tại:

- Tỷ số ≥1,2×: mở rộng.
- Tỷ số ≤0,8×: thu hẹp.
- Giữa hai mốc: gần nền.
- Nền bằng 0 hoặc thiếu mẫu: không tính tỷ số.

Các mốc 1,2×/0,8× là **quy tắc quan sát riêng**, không phải công thức gốc ATR và chưa kiểm định. ATR không cho hướng Long/Short, không dự báo khoảng giá tương lai, không tạo stop, đòn bẩy hay lợi nhuận dự kiến.

## 7. Supertrend10×3 — xu hướng theo ATR

`HL2 = (High + Low)/2`; dải cơ bản bằng `HL2 ± 3×ATR10`. Dải cuối kế thừa dải trước theo quy tắc Supertrend; giá đóng vượt dải trên chuyển sang tăng, xuyên dải dưới chuyển sang giảm. ATR10 dùng Wilder RMA. Supertrend có thể đổi hướng liên tục khi thị trường đi ngang.

## 8. Ichimoku 9–26–52 — vị trí so với mây

Conversion là trung điểm high/low 9 nến, Base là trung điểm 26 nến. Span A là trung bình Conversion và Base; Span B là trung điểm 52 nến, cả hai được đối chiếu tại vị trí dịch 26 nến. Chỉ báo tăng khi Close trên toàn bộ mây và Span A > Span B; giảm khi Close dưới mây và Span A < Span B; trường hợp khác `Chưa rõ`. Mây là dữ liệu lịch sử, không phải dự báo chắc chắn.

## 9. Stochastic 14–3–3 — động lượng vùng biên

Raw %K đặt Close trong biên high/low 14 nến; %K hiển thị là SMA3 của raw %K, %D là SMA3 của %K. Theo quy tắc Technical Ratings: K,D <20 và K>D là tăng; K,D >80 và K<D là giảm; còn lại `Chưa rõ`. Vùng quá mua/quá bán không tự đồng nghĩa đảo chiều.

## 10. CCI20 — độ lệch khỏi trung bình

`TP=(H+L+C)/3`; `CCI=(TP−SMA20(TP))/(0,015×MeanDeviation20)`. CCI <−100 và tăng so với nến trước được gắn tăng; CCI >100 và giảm được gắn giảm; còn lại `Chưa rõ`. Ngưỡng cực trị có thể cần hiệu chỉnh theo tài sản.

## 11. MACD 12–26–9 — giao cắt động lượng

MACD = EMA12(Close) − EMA26(Close); Signal = EMA9 của chuỗi MACD hợp lệ. MACD trên Signal là tăng, dưới Signal là giảm, bằng hoặc thiếu mẫu là `Chưa rõ`. EMA đều khởi tạo bằng SMA đúng chu kỳ. MACD là chỉ báo trễ và dễ nhiễu trong vùng đi ngang.

## 12. Momentum10 — thay đổi động lượng

`Momentum(t)=Close(t)−Close(t−10)`. Theo Technical Ratings, Momentum hiện tại cao hơn nến trước là tăng, thấp hơn là giảm, bằng hoặc thiếu mẫu là `Chưa rõ`. Đây là phép đo phản ứng nhanh nên có thể đổi hướng thường xuyên.

## Giao diện và quan hệ với tín hiệu chính

Mười hai thẻ nằm trong mục **Hướng theo phương pháp**, mở sẵn. Mỗi thẻ chỉ hiển thị tên và tag tăng/giảm/chưa rõ; công thức, quy tắc và giới hạn được giữ trong tài liệu này. Thời gian nến và khung áp dụng được ghi ở đầu mục.

Chọn **Vẽ thêm**: Chỉ EMA / Bollinger / Donchian / VWAP. Luôn giữ bốn đường cơ sở gồm giá đóng và ba EMA. Chỉ thêm một lớp mỗi lần; đổi lớp không gọi API hoặc đổi kết luận EMA. RSI/ADX/ATR có thang đo riêng nên không vẽ chung lên trục giá.

Các phương pháp có thể mâu thuẫn và không phải các phiếu độc lập: nhiều công thức dùng lại cùng giá đóng. Không tổng hợp số phương pháp cùng chiều thành độ tin cậy, xác suất thắng hoặc tín hiệu thay thế. Lỗi/cũ dữ liệu, đổi coin/khung đều xóa phần bổ sung cùng kết quả chính.

## Kiểm chứng

Có các bộ dữ liệu đáp án tính tay: Wilder RMA, RSI, ATR, DI/ADX, Bollinger, Donchian, VWAP, SMA/Stochastic, Supertrend, Ichimoku, CCI, MACD và Momentum. Kiểm tra cả chuỗi tăng/giảm/phẳng, nến mở, thiếu mẫu, volume 0, dải phẳng, phản hồi sai thứ tự, và kết luận EMA không thay đổi khi bật lớp bổ sung.

Các kiểm thử này xác minh cách tính/hiển thị, không chứng minh hiệu quả chiến lược. Chưa có backtest hoặc tự động giao dịch.
