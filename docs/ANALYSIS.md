# Các phương pháp phân tích bổ sung

Bổ sung 30 phương pháp trên cùng **nến giao dịch Futures đã đóng** của khung đang xem. Mặc định SOLUSDT/M30; khung chọn M15, M30, H1. Không thêm nguồn dữ liệu hoặc request API. Các phương pháp không thay đổi `CoinCore.evaluate`, không tạo lệnh hay xác suất thắng. Tám mô hình 3-EMA mới được diễn giải từ tài liệu người dùng; phần quản trị lệnh, đòn bẩy và tự động hóa trong tài liệu không được áp dụng.

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
| Aroon14 | Đỉnh hay đáy mới xuất hiện gần hơn? | [TradingView Aroon](https://www.tradingview.com/support/solutions/43000501801-aroon-indicator/) |
| ROC9 | Giá đóng thay đổi bao nhiêu phần trăm so với 9 nến trước? | [TradingView ROC](https://www.tradingview.com/support/solutions/43000502343-rate-of-change-roc/) |
| Williams %R14 | Động lượng có rời vùng cực trị theo quy tắc Technical Ratings? | [TradingView Williams %R](https://www.tradingview.com/support/solutions/43000501985-williams-r-r/) |
| MFI14 | Áp lực mua hay bán theo giá và volume đang trội? | [TradingView MFI](https://www.tradingview.com/support/solutions/43000502348-money-flow-mfi/) |
| OBV | Volume tích lũy theo hướng giá đóng tăng hay giảm? | [TradingView OBV](https://www.tradingview.com/support/solutions/43000502593-on-balance-volume-obv/) |
| Chaikin 3–10 | Động lượng của Accumulation/Distribution dương hay âm? | [TradingView Chaikin Oscillator](https://www.tradingview.com/support/solutions/43000501979-chaikin-oscillator/) |
| Awesome Oscillator 5–34 | Động lượng giá trung vị vừa giao qua 0 hay quay hướng? | [TradingView Technical Ratings](https://www.tradingview.com/support/solutions/43000614331-technical-ratings/) |
| Stochastic RSI 3–3–14–14 | RSI đang quay khỏi vùng cực trị cùng điều kiện xu hướng? | [TradingView Technical Ratings](https://www.tradingview.com/support/solutions/43000614331-technical-ratings/) |
| Bull Bear Power13 | Sức mua/bán quanh EMA13 đang cải thiện hay suy yếu? | [TradingView Bull Bear Power](https://www.tradingview.com/support/solutions/43000717955-bull-bear-power/) |
| Ultimate Oscillator 7–14–28 | Buying pressure ba cửa sổ đang ở vùng cực trị nào? | [TradingView Ultimate Oscillator](https://www.tradingview.com/support/solutions/43000502328-ultimate-oscillator-uo/) |

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

## 13. Aroon14 — độ gần của đỉnh và đáy

Aroon Up/Down quy đổi số nến kể từ đỉnh/đáy 14 nến gần nhất về thang 0–100. Tăng khi Up >50 và Down <50; giảm khi Down >50 và Up <50; còn lại `Chưa rõ`. Nếu có nhiều cực trị bằng nhau, lấy cực trị gần hiện tại nhất.

## 14. ROC9 — tốc độ thay đổi

`ROC = (Close(t) / Close(t−9) − 1) × 100`. ROC dương là tăng, âm là giảm, bằng 0 hoặc thiếu mẫu là `Chưa rõ`. ROC không bị chặn biên và phụ thuộc điểm giá dùng để so sánh.

## 15. Williams %R14 — động lượng vùng cực trị

`%R = −100 × (HighestHigh14 − Close) / (HighestHigh14 − LowestLow14)`. Theo Technical Ratings: tăng khi %R <−80 và đang đi lên; giảm khi %R >−20 và đang đi xuống; còn lại `Chưa rõ`. Dải phẳng trả −50 để tránh chia cho 0.

## 16. MFI14 — dòng tiền theo giá và volume

Typical Price bằng `(H+L+C)/3`; raw money flow bằng Typical Price nhân Volume. Tổng flow của các nến có Typical Price tăng và giảm tạo Money Flow Ratio, sau đó `MFI = 100 − 100/(1+ratio)`. Mốc 50 phân hướng; không có flow trả 50.

## 17. OBV — volume tích lũy theo hướng giá

Volume được cộng khi Close tăng, trừ khi Close giảm và giữ nguyên khi bằng nến trước. Vì mức OBV tuyệt đối phụ thuộc điểm bắt đầu, giao diện chỉ phân hướng bằng chênh OBV hiện tại so với 3 nến trước.

## 18. Chaikin Oscillator 3–10 — động lượng Accumulation/Distribution

Money Flow Multiplier bằng `[(Close−Low)−(High−Close)]/(High−Low)`; nến không có biên dùng 0. Money Flow Volume được tích lũy thành ADL. Chaikin bằng `EMA3(ADL) − EMA10(ADL)`; dương là tăng, âm là giảm, bằng 0 là `Chưa rõ`.

## 19. Awesome Oscillator 5–34 — giao và quay động lượng

`AO = SMA5((High+Low)/2) − SMA34((High+Low)/2)`. Theo Technical Ratings, tăng khi AO giao lên 0 hoặc ở trên 0 hai nến liên tiếp rồi quay lên; giảm khi điều kiện đảo lại. Không có sự kiện mới thì `Chưa rõ`.

## 20. Stochastic RSI 3–3–14–14 — động lượng của RSI

RSI14 được đặt vào biên cao–thấp của chính nó trong 14 nến; raw Stoch RSI được làm mượt SMA3 thành K và SMA3 lần nữa thành D. Tăng khi EMA13 đang giảm, K/D <20 và K>D; giảm khi EMA13 đang tăng, K/D >80 và K<D. Đây là quy tắc Technical Ratings, không phải dự báo đảo chiều độc lập.

## 21. Bull Bear Power13 — sức mua/bán quanh EMA

`Bull Power = High − EMA13(Close)` và `Bear Power = Low − EMA13(Close)`. Tăng khi EMA13 đi lên, Bear Power âm nhưng cải thiện; giảm khi EMA13 đi xuống, Bull Power dương nhưng suy yếu. Trường hợp khác `Chưa rõ`.

## 22. Ultimate Oscillator 7–14–28 — buying pressure đa cửa sổ

`BP = Close − min(Low, Close trước)`; `TR = max(High, Close trước) − min(Low, Close trước)`. Tỷ lệ tổng BP/TR được tính cho 7, 14 và 28 nến, sau đó `UO = 100×(4×Avg7 + 2×Avg14 + Avg28)/7`. Theo Technical Ratings, trên 70 là tăng, dưới 30 là giảm. Dải phẳng hoàn toàn được quy về 50 trung tính.

## 23–30. Cụm mô hình 3-EMA từ tài liệu người dùng

- **EMA100 Breakout & Retest:** 10 nến cùng phía cũ, nến trước cắt EMA100 với volume tối thiểu 1,5 lần SMA20, nến cuối retest và đóng đúng màu.
- **HTF Rejection:** biên nến giao EMA50 hoặc EMA100 của khung lớn đã đóng, râu từ chối chiếm ít nhất 50% biên và Close quay về đúng phía EMA20 khung hiện tại.
- **EMA Squeeze:** khoảng cách EMA20–50 không quá 0,4 ATR, có Inside Bar, nến cuối phá Mother Bar với volume tối thiểu 1,2 lần SMA20.
- **Hidden Divergence:** hai pivot 5 nến đã xác nhận tạo cấu trúc giá và RSI phân kỳ kín, pivot sau nằm trong 0,3 ATR quanh EMA50/100 và nến cuối đúng màu.
- **EMA 2B Sweep:** nến trước xuyên EMA50, nến cuối engulfing ngược hướng, đóng trở lại phía kia EMA50 và volume tăng.
- **Rubber Band:** Close cách EMA20 tối thiểu 3 ATR, RSI ≤25 hoặc ≥75, có Doji/Hammer/Shooting Star và nến cuối phá biên theo hướng hồi quy.
- **EMA50 Double Test:** hai lần chạm EMA50 cách nhau 3–8 nến; lần hai không xuyên sâu quá 0,2 ATR và đóng đúng màu. Phiên bản hiện tại không xác nhận riêng mức nảy 0,8 ATR nếu chuỗi chạm liên tục.
- **Trend Surfing:** ADX ≥30 và đang tăng, độ dốc EMA20 ba nến tối thiểu 1,5 ATR, nến trước retest nông EMA20 và nến cuối phá biên.

P1 Value Zone Pullback của tài liệu trùng quy tắc EMA chính nên không được đếm thêm. Các mô hình trên chỉ trả tăng/giảm/chưa rõ; không tự đặt Entry, SL, TP, position size, đòn bẩy, pyramiding hay webhook.

## Kịch bản giá tham khảo

Khi hướng EMA hiện tại khác 0, giao diện hiển thị một kịch bản kỹ thuật thay cho thông báo đối chiếu khung lớn:

- Hướng tăng: `Vô hiệu = min(Low của 4 nến cuối, EMA50) − 0,5×ATR14`.
- Hướng giảm: `Vô hiệu = max(High của 4 nến cuối, EMA50) + 0,5×ATR14`.
- `R = khoảng cách có hướng từ giá đóng nến cuối tới mức vô hiệu`.
- `TP1 = Giá đóng ± 1,3R`; `TP2 = Giá đóng ± 2,2R` theo hướng quan sát.

Nếu ATR không hợp lệ, hướng chưa rõ hoặc mức vô hiệu tạo `R ≤ 0`, khối này không hiển thị. Các mức không được lưu như lệnh và không dùng ticker hay Mark Price làm giá tham chiếu.

## Đồng thuận M15–M30–H1

Với từng khung, hệ thống tính hướng EMA bằng đúng thứ tự EMA20–50–100 và độ dốc 3 nến. Đồng thời đếm hướng của 30 phương pháp trên chính 500 nến đã đóng của khung đó. Khung chỉ được gắn tăng/giảm khi hướng EMA khác 0 và trùng với dấu của `(số tăng − số giảm)`. Kết quả chung là tăng hoặc giảm khi ít nhất 2 trong 3 khung cùng hướng; nếu không thì `Chưa đồng thuận`.

Lớp này tái sử dụng dữ liệu M15, M30 và H1 đã tải, không thêm request. Nó không sửa `CoinCore.evaluate`, không biến tín hiệu cũ thành tín hiệu mới và không thay thế yêu cầu khung lớn của xác nhận EMA chính.

## Giao diện và quan hệ với tín hiệu chính

Ba mươi thẻ nằm trong mục **Hướng theo phương pháp**, mở sẵn và chia thành năm cụm: xu hướng/cấu trúc, động lượng, dòng tiền/khối lượng, biến động và mô hình 3-EMA. Mỗi thẻ chỉ hiển thị tên và tag tăng/giảm/chưa rõ. Biểu đồ vẫn chỉ vẽ giá đóng và EMA20–50–100 để tránh quá tải.

Các phương pháp có thể mâu thuẫn và không phải các phiếu độc lập: nhiều công thức dùng lại cùng giá đóng. Không tổng hợp số phương pháp cùng chiều thành độ tin cậy, xác suất thắng hoặc tín hiệu thay thế. Lỗi/cũ dữ liệu, đổi coin/khung đều xóa phần bổ sung cùng kết quả chính.

## Kiểm chứng

Có các bộ dữ liệu đáp án tính tay và chuỗi kỳ vọng cho Wilder RMA, RSI, ATR, DI/ADX, Bollinger, Donchian, VWAP, SMA/Stochastic, Supertrend, Ichimoku, CCI, MACD, Momentum, Aroon, ROC, Williams %R, MFI, OBV, Chaikin, AO, Stochastic RSI, Bull Bear Power và Ultimate Oscillator. Kiểm tra cả chuỗi tăng/giảm/phẳng, nến mở, thiếu mẫu, volume 0, dải phẳng, phản hồi sai thứ tự và việc kết luận EMA không thay đổi.

Các kiểm thử này xác minh cách tính/hiển thị, không chứng minh hiệu quả chiến lược. Chưa có backtest hoặc tự động giao dịch.
