# -*- coding: utf-8 -*-
"""
ngan_hang_cau_hoi.py - Ngân hàng 28 câu hỏi rẽ nhánh thích ứng (5 tầng × 3 bước = 15 câu/học sinh)
dùng chung cho server.py và trang test index.html.
"""

CHUYEN_9_MON = ["Toán", "Tin", "Lý", "Hóa", "Sinh", "Văn", "Sử", "Địa", "Anh"]

TANG_MO_TA = {
    1: "Tầng 1: Nhận diện Trục năng khiếu & Tư duy tổng quan",
    2: "Tầng 2: Bóc tách Phân môn chuyên sâu (KHTN / KHXH / Toán-Tin / Văn-Anh)",
    3: "Tầng 3: Tác phong học thuật & Môi trường làm việc ưa thích",
    4: "Tầng 4: Sức bền tư duy & Bản lĩnh trước bài toán chuyên sâu",
    5: "Tầng 5: Khát vọng nghề nghiệp & Đích đến tương lai",
}

QUESTION_BANK = {
    "Q1": {
        "question_id": "Q1",
        "phase": 1,
        "title": "Tiếp cận vấn đề & Đề tài nghiên cứu mới",
        "scenario": "Trường phát động ngày hội nghiên cứu khoa học với một chủ đề mở về thành phố tương lai. Cách em hào hứng bắt đầu nhất là:",
        "options": [
            {
                "opt": "A",
                "text": "Xây dựng mô hình toán học giải quyết tắc nghẽn giao thông hoặc viết thuật toán quản lý năng lượng thông minh.",
                "next_id": "Q2A",
                "scores": {"Toán": 3, "Tin": 3},
            },
            {
                "opt": "B",
                "text": "Thử nghiệm vật liệu xây dựng mới chịu nhiệt, hệ thống pin năng lượng mặt trời hoặc quy trình xử lý rác bằng vi sinh.",
                "next_id": "Q2B",
                "scores": {"Lý": 2, "Hóa": 2, "Sinh": 2},
            },
            {
                "opt": "C",
                "text": "Tìm hiểu nếp sống thị dân xưa và nay, viết bài khảo cứu lịch sử hoặc khảo sát sự biến đổi không gian đô thị.",
                "next_id": "Q2C",
                "scores": {"Văn": 3, "Sử": 2, "Địa": 2},
            },
            {
                "opt": "D",
                "text": "Tìm kiếm tài liệu và mô hình đô thị thông minh từ các nước tiên tiến trên thế giới bằng tiếng Anh.",
                "next_id": "Q2D",
                "scores": {"Anh": 3, "Tin": 1, "Địa": 1},
            },
        ],
    },
    "Q2A": {
        "question_id": "Q2A",
        "phase": 1,
        "title": "Nhánh Logic — Phương thức tư duy toán học & Công nghệ",
        "scenario": "Khi đối mặt với một câu đố tư duy hóc búa, phong cách xử lý khiến em say mê nhất là:",
        "options": [
            {
                "opt": "A",
                "text": "Ngồi trầm ngâm với giấy nháp, chứng minh từng bước chặt chẽ bằng hình học hoặc đại số thuần túy.",
                "next_id": "Q3A",
                "scores": {"Toán": 4, "Lý": 1},
            },
            {
                "opt": "B",
                "text": "Bật máy tính, phân tích cấu trúc dữ liệu và thử viết mã lệnh (code) để máy tính chạy thử nghiệm.",
                "next_id": "Q3B",
                "scores": {"Tin": 4, "Toán": 2},
            },
            {
                "opt": "C",
                "text": "Vẽ sơ đồ lực, thiết lập phương trình cân bằng chuyển động hoặc mạch điện tương đương.",
                "next_id": "Q3C",
                "scores": {"Lý": 4, "Toán": 2},
            },
            {
                "opt": "D",
                "text": "Thu thập số liệu, lập bảng biểu thống kê và tìm ra quy luật ẩn giấu đằng sau các con số.",
                "next_id": "Q3A",
                "scores": {"Toán": 2, "Tin": 2, "Địa": 2},
            },
        ],
    },
    "Q2B": {
        "question_id": "Q2B",
        "phase": 1,
        "title": "Nhánh KHTN Thực nghiệm — Bóc tách bước đầu Khoa học Tự nhiên",
        "scenario": "Trong giờ thực hành KHTN tại phòng thí nghiệm trường, khoảnh khắc nào làm em thấy kỳ diệu nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Lắp ráp thí nghiệm con lắc, đo chu kỳ dao động, đo cường độ dòng điện và kiểm chứng định luật vật lý.",
                "next_id": "Q3C",
                "scores": {"Lý": 4, "Toán": 1},
            },
            {
                "opt": "B",
                "text": "Pha chế hóa chất, quan sát dung dịch đổi màu bất ngờ, kết tủa lấp lánh và đo lượng nhiệt phản ứng tỏa ra.",
                "next_id": "Q3D",
                "scores": {"Hóa": 4, "Lý": 1},
            },
            {
                "opt": "C",
                "text": "Điều chỉnh kính hiển vi, quan sát từng tế bào sống, lục lạp chuyển động và cơ chế phân bào nguyên nhiễm.",
                "next_id": "Q3D",
                "scores": {"Sinh": 4, "Hóa": 1},
            },
            {
                "opt": "D",
                "text": "Khám phá cách chế tạo thuốc chữa bệnh từ cây cỏ tự nhiên kết hợp công nghệ sinh học và nano.",
                "next_id": "Q3D",
                "scores": {"Hóa": 2, "Sinh": 3, "Lý": 1},
            },
        ],
    },
    "Q2C": {
        "question_id": "Q2C",
        "phase": 1,
        "title": "Nhánh KHXH & Nhân văn — Bóc tách bước đầu Khoa học Xã hội",
        "scenario": "Khi nghe một câu chuyện về vùng đất ngàn năm văn hiến, khía cạnh nào thôi thúc em khám phá sâu nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Chiều sâu cảm xúc, vẻ đẹp tâm hồn con người thể hiện qua những áng thơ ca và văn chương của thời đại.",
                "next_id": "Q3E",
                "scores": {"Văn": 4, "Anh": 1},
            },
            {
                "opt": "B",
                "text": "Các triều đại thịnh suy, những chiến công hiển hách chống ngoại xâm và bài học giữ nước của tiền nhân.",
                "next_id": "Q3F",
                "scores": {"Sử": 4, "Văn": 1},
            },
            {
                "opt": "C",
                "text": "Vị trí địa lý đắc địa 'tiền tam giang hậu thất diệu', khí hậu phong thủy và sự trù phú về kinh tế vùng miền.",
                "next_id": "Q3F",
                "scores": {"Địa": 4, "Sử": 1},
            },
            {
                "opt": "D",
                "text": "Tác động qua lại giữa luật pháp, đạo đức xã hội và đời sống thường nhật của người dân qua các thời kỳ.",
                "next_id": "Q3E",
                "scores": {"Văn": 2, "Sử": 2, "Địa": 2},
            },
        ],
    },
    "Q2D": {
        "question_id": "Q2D",
        "phase": 1,
        "title": "Nhánh Ngoại ngữ & Hội nhập — Vai trò Tiếng Anh & Năng lực toàn cầu",
        "scenario": "Em nhìn nhận năng lực Tiếng Anh xuất sắc sẽ là đòn bẩy lớn nhất cho việc gì trong tương lai:",
        "options": [
            {
                "opt": "A",
                "text": "Tham gia các hội nghị tranh biện quốc tế (MUN), đàm phán ngoại giao và bảo vệ các giá trị nhân văn.",
                "next_id": "Q3G",
                "scores": {"Anh": 4, "Văn": 2},
            },
            {
                "opt": "B",
                "text": "Đọc trực tiếp các bài báo khoa học, giáo trình đại học hàng đầu thế giới mà không cần dịch.",
                "next_id": "Q3G",
                "scores": {"Anh": 4, "Toán": 1, "Sử": 1},
            },
            {
                "opt": "C",
                "text": "Học các khóa học trí tuệ nhân tạo, công nghệ cao trực tuyến và giao lưu với lập trình viên toàn cầu.",
                "next_id": "Q3B",
                "scores": {"Anh": 2, "Tin": 3, "Toán": 1},
            },
            {
                "opt": "D",
                "text": "Du hành khắp năm châu, khám phá địa lý, đa dạng sinh học và văn hóa phong phú của các dân tộc.",
                "next_id": "Q3F",
                "scores": {"Anh": 2, "Địa": 3, "Sinh": 1},
            },
        ],
    },
    "Q3A": {
        "question_id": "Q3A",
        "phase": 1,
        "title": "Toán học chuyên sâu — Mỹ cảm trong Toán học thuần túy",
        "scenario": "Khi tìm ra lời giải cho một bài toán khó, điều gì mang lại cho em cảm giác thỏa mãn tột cùng nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Tìm ra một cách giải độc đáo, ngắn gọn chỉ trong 3 dòng dựa trên một nhận xét tinh tế về tính chất đại số/hình học.",
                "next_id": "Q4A",
                "scores": {"Toán": 4},
            },
            {
                "opt": "B",
                "text": "Tổng quát hóa bài toán đó thành một định lý tổng quát áp dụng cho mọi trường hợp mở rộng.",
                "next_id": "Q4A",
                "scores": {"Toán": 4, "Tin": 2},
            },
            {
                "opt": "C",
                "text": "Lập luận phản chứng chặt chẽ, bịt kín mọi kẽ hở logic mà không ai có thể bẻ gãy được.",
                "next_id": "Q4A",
                "scores": {"Toán": 3, "Văn": 1},
            },
            {
                "opt": "D",
                "text": "Ứng dụng ngay công thức vừa chứng minh để giải quyết một bài toán tính toán trong Vật lý hoặc Tin học.",
                "next_id": "Q4A",
                "scores": {"Toán": 2, "Lý": 2, "Tin": 2},
            },
        ],
    },
    "Q3B": {
        "question_id": "Q3B",
        "phase": 1,
        "title": "Tin học chuyên sâu — Tư duy Thuật toán & Hệ thống máy tính",
        "scenario": "Trong thế giới công nghệ và lập trình, thử thách nào em cảm thấy thôi thúc chinh phục nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Tối ưu hóa thời gian chạy của thuật toán từ O(N²) xuống O(N log N) bằng kỹ thuật quy hoạch động hoặc chia để trị.",
                "next_id": "Q4A",
                "scores": {"Tin": 4, "Toán": 2},
            },
            {
                "opt": "B",
                "text": "Tự tay thiết kế và lập trình hoàn thiện một ứng dụng web/mobile hữu ích phục vụ cuộc sống học đường.",
                "next_id": "Q4A",
                "scores": {"Tin": 4, "Anh": 1},
            },
            {
                "opt": "C",
                "text": "Nghiên cứu cơ chế huấn luyện các mô hình trí tuệ nhân tạo (AI) nhận diện giọng nói hoặc hình ảnh.",
                "next_id": "Q4A",
                "scores": {"Tin": 4, "Toán": 2},
            },
            {
                "opt": "D",
                "text": "Tìm hiểu an ninh mạng, phân tích các lỗ hổng bảo mật và cách phòng chống mã độc.",
                "next_id": "Q4A",
                "scores": {"Tin": 3, "Anh": 2},
            },
        ],
    },
    "Q3C": {
        "question_id": "Q3C",
        "phase": 1,
        "title": "Vật lý chuyên sâu — Quy luật Vũ trụ & Vật chất",
        "scenario": "Khi quan sát thế giới xung quanh, hiện tượng vật lý nào kích thích trí tò mò của em mạnh mẽ nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Lực hấp dẫn, thuyết tương đối và bí ẩn của các lỗ đen trong vũ trụ bao la.",
                "next_id": "Q4B",
                "scores": {"Lý": 4, "Toán": 2},
            },
            {
                "opt": "B",
                "text": "Nguyên lý cảm ứng điện từ, sóng vô tuyến và cách chế tạo động cơ điện không chổi than hiện đại.",
                "next_id": "Q4B",
                "scores": {"Lý": 4, "Tin": 1},
            },
            {
                "opt": "C",
                "text": "Bản chất lưỡng tính sóng - hạt của ánh sáng và thế giới hạt cơ bản hạ nguyên tử.",
                "next_id": "Q4B",
                "scores": {"Lý": 4, "Hóa": 2},
            },
            {
                "opt": "D",
                "text": "Cơ học kết cấu, thiết kế hình dáng khí động học của máy bay và tên lửa siêu thanh.",
                "next_id": "Q4B",
                "scores": {"Lý": 4, "Toán": 2},
            },
        ],
    },
    "Q3D": {
        "question_id": "Q3D",
        "phase": 1,
        "title": "Hóa - Sinh chuyên sâu — Thế giới Phân tử & Sự sống",
        "scenario": "Nếu được tham gia một dự án nghiên cứu đỉnh cao, em sẽ chọn chủ đề nào:",
        "options": [
            {
                "opt": "A",
                "text": "Tổng hợp một loại vật liệu polymer mới siêu bền, siêu nhẹ và có khả năng tự phục hồi khi bị trầy xước.",
                "next_id": "Q4C",
                "scores": {"Hóa": 4, "Lý": 1},
            },
            {
                "opt": "B",
                "text": "Giải mã bộ gen của các loài sinh vật bản địa quý hiếm để bảo tồn nguồn gen và lai tạo giống chống biến đổi khí hậu.",
                "next_id": "Q4C",
                "scores": {"Sinh": 4},
            },
            {
                "opt": "C",
                "text": "Thiết kế chất ức chế enzyme để ngăn chặn sự phát triển của tế bào ung thư mà không gây hại tế bào lành.",
                "next_id": "Q4C",
                "scores": {"Hóa": 3, "Sinh": 3},
            },
            {
                "opt": "D",
                "text": "Nghiên cứu pin nhiên liệu hydro sạch và pin lithium cải tiến để thay thế hoàn toàn xăng dầu.",
                "next_id": "Q4B",
                "scores": {"Hóa": 3, "Lý": 3},
            },
        ],
    },
    "Q3E": {
        "question_id": "Q3E",
        "phase": 1,
        "title": "Ngữ văn chuyên sâu — Chiều sâu Văn học & Nghệ thuật biểu đạt",
        "scenario": "Khi viết một bài văn nghị luận xã hội hoặc văn học, phẩm chất nào em muốn thể hiện rõ nét nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Trái tim giàu trắc ẩn, sự đồng cảm sâu sắc với số phận những con người bình dị và khát vọng công bằng.",
                "next_id": "Q4D",
                "scores": {"Văn": 4},
            },
            {
                "opt": "B",
                "text": "Văn phong sắc bén, lập luận chặt chẽ như một luật sư, dùng dẫn chứng xác đáng để làm sáng tỏ chân lý.",
                "next_id": "Q4D",
                "scores": {"Văn": 4, "Sử": 2},
            },
            {
                "opt": "C",
                "text": "Ngôn từ giàu tính nhạc điệu, hình ảnh sáng tạo và phong cách biểu đạt mang đậm dấu ấn cá nhân.",
                "next_id": "Q4D",
                "scores": {"Văn": 4, "Anh": 1},
            },
            {
                "opt": "D",
                "text": "Khả năng soi chiếu tác phẩm văn học dưới góc nhìn lịch sử thời đại và tâm lý học xã hội.",
                "next_id": "Q4D",
                "scores": {"Văn": 3, "Sử": 2, "Địa": 1},
            },
        ],
    },
    "Q3F": {
        "question_id": "Q3F",
        "phase": 1,
        "title": "Lịch sử & Địa lí — Bức tranh Lịch sử & Không gian Địa lý",
        "scenario": "Một chuyến đi thực tế đến vùng địa đầu Tổ quốc (như Hà Giang hay Cà Mau) gợi cho em nhiều suy tưởng nhất về:",
        "options": [
            {
                "opt": "A",
                "text": "Cột cờ Lũng Cú linh thiêng, những trang sử gìn giữ biên cương hàng ngàn năm của các thế hệ cha anh.",
                "next_id": "Q4D",
                "scores": {"Sử": 4},
            },
            {
                "opt": "B",
                "text": "Cao nguyên đá Đồng Văn độc nhất vô nhị, cấu tạo địa chất karst và cách người dân thích nghi với sự thiếu nước.",
                "next_id": "Q4D",
                "scores": {"Địa": 4},
            },
            {
                "opt": "C",
                "text": "Bản sắc văn hóa, kiến trúc nhà trình tường và phong tục tập quán độc đáo của các đồng bào dân tộc thiểu số.",
                "next_id": "Q4D",
                "scores": {"Văn": 2, "Sử": 2, "Địa": 2},
            },
            {
                "opt": "D",
                "text": "Chiến lược phát triển kinh tế cửa khẩu, quy hoạch du lịch sinh thái gắn liền với an ninh quốc phòng.",
                "next_id": "Q4D",
                "scores": {"Địa": 3, "Sử": 2},
            },
        ],
    },
    "Q3G": {
        "question_id": "Q3G",
        "phase": 1,
        "title": "Tiếng Anh học thuật — Ngôn ngữ Toàn cầu & Tư duy Quốc tế",
        "scenario": "Trong các cuộc thi học thuật quốc tế bằng tiếng Anh, phần thử thách nào em cảm thấy tự tin và hứng thú nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Hùng biện và phản biện trực tiếp trước ban giám khảo về các vấn đề nóng của thế giới (AI, bình đẳng giới, biến đổi khí hậu).",
                "next_id": "Q4D",
                "scores": {"Anh": 4, "Văn": 2},
            },
            {
                "opt": "B",
                "text": "Đọc hiểu và tóm tắt một bài tiểu luận nghiên cứu dài 20 trang với nhiều thuật ngữ học thuật chuyên sâu.",
                "next_id": "Q4D",
                "scores": {"Anh": 4, "Sử": 1},
            },
            {
                "opt": "C",
                "text": "Viết bài luận nghị luận học thuật chuẩn mực với cấu trúc luận điểm logic, dẫn chứng quốc tế thuyết phục.",
                "next_id": "Q4D",
                "scores": {"Anh": 4, "Văn": 2},
            },
            {
                "opt": "D",
                "text": "Dịch thuật các tác phẩm văn học hoặc tài liệu khoa học song ngữ đòi hỏi độ chuẩn xác và uyển chuyển cao.",
                "next_id": "Q4D",
                "scores": {"Anh": 3, "Văn": 2, "Tin": 1},
            },
        ],
    },
    "Q4A": {
        "question_id": "Q4A",
        "phase": 2,
        "title": "Phân định Toán vs Tin — Công cụ giải quyết bài toán lớn",
        "scenario": "Một công ty logistics cần tìm lộ trình giao hàng tối ưu cho 10.000 bưu kiện mỗi ngày. Em sẽ tiếp cận vấn đề theo cách nào:",
        "options": [
            {
                "opt": "A",
                "text": "Dùng lý thuyết đồ thị (Graph Theory) thuần túy để chứng minh các định lý về đường đi Hamilton và cận trên của bài toán.",
                "next_id": "Q5A",
                "scores": {"Toán": 4, "Tin": 1},
            },
            {
                "opt": "B",
                "text": "Lập trình cài đặt các thuật toán heuristic (Genetic Algorithm hay Simulated Annealing) để tìm nghiệm xấp xỉ tối ưu.",
                "next_id": "Q5A",
                "scores": {"Tin": 4, "Toán": 2},
            },
            {
                "opt": "C",
                "text": "Số hóa bản đồ giao thông thực tế, phân tích dữ liệu GIS không gian và mật độ xe theo giờ.",
                "next_id": "Q5A",
                "scores": {"Tin": 2, "Địa": 3, "Toán": 1},
            },
            {
                "opt": "D",
                "text": "Thiết lập hệ phương trình tối ưu hóa kinh tế vĩ mô để cân đối chi phí nhiên liệu và khấu hao phương tiện.",
                "next_id": "Q5A",
                "scores": {"Toán": 3, "Lý": 1},
            },
        ],
    },
    "Q4B": {
        "question_id": "Q4B",
        "phase": 2,
        "title": "Phân định Vật lý vs Hóa học — Bản chất Công nghệ Pin tương lai",
        "scenario": "Khi nghiên cứu việc nâng cấp pin cho xe điện để chạy được 1.000 km sau 1 lần sạc, câu hỏi làm em trăn trở nhất là:",
        "options": [
            {
                "opt": "A",
                "text": "Làm sao cải thiện cấu trúc mạng tinh thể của điện cực và dung môi điện phân để tăng mật độ lưu trữ ion lithium.",
                "next_id": "Q5B",
                "scores": {"Hóa": 4, "Lý": 1},
            },
            {
                "opt": "B",
                "text": "Giải bài toán tản nhiệt cưỡng bức, hiệu ứng Joule và hiện tượng quá dòng khi sạc siêu nhanh 15 phút.",
                "next_id": "Q5B",
                "scores": {"Lý": 4, "Toán": 1},
            },
            {
                "opt": "C",
                "text": "Quy trình tái chế thu hồi các kim loại quý (Niken, Coban, Mangan) mà không gây ô nhiễm môi trường đất và nước.",
                "next_id": "Q5B",
                "scores": {"Hóa": 3, "Sinh": 2},
            },
            {
                "opt": "D",
                "text": "Chế tạo vật liệu siêu dẫn nhiệt độ phòng để triệt tiêu hoàn toàn điện trở hao phí.",
                "next_id": "Q5B",
                "scores": {"Lý": 4, "Hóa": 2},
            },
        ],
    },
    "Q4C": {
        "question_id": "Q4C",
        "phase": 2,
        "title": "Phân định Hóa học vs Sinh học — Ứng dụng Y dược & Đời sống",
        "scenario": "Để đối phó với một chủng vi khuẩn mới kháng kháng sinh, hướng nghiên cứu nào em muốn dấn thân nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Nghiên cứu cơ chế enzyme và thành tế bào vi khuẩn, sử dụng công nghệ chỉnh sửa gen CRISPR để vô hiệu hóa gen kháng thuốc.",
                "next_id": "Q5B",
                "scores": {"Sinh": 4, "Hóa": 1},
            },
            {
                "opt": "B",
                "text": "Tổng hợp các phân tử hóa học hữu cơ mới chưa từng có trong tự nhiên có khả năng phá vỡ màng lipid của vi khuẩn.",
                "next_id": "Q5B",
                "scores": {"Hóa": 4},
            },
            {
                "opt": "C",
                "text": "Sử dụng virus thực khuẩn (Bacteriophage) như một liệu pháp sinh học tự nhiên để tiêu diệt vi khuẩn mục tiêu.",
                "next_id": "Q5B",
                "scores": {"Sinh": 4},
            },
            {
                "opt": "D",
                "text": "Kết hợp các nano bạc và phức chất kim loại chuyển tiếp để tạo màng kháng khuẩn bề mặt.",
                "next_id": "Q5B",
                "scores": {"Hóa": 3, "Lý": 2},
            },
        ],
    },
    "Q4D": {
        "question_id": "Q4D",
        "phase": 2,
        "title": "Phân định Văn vs Sử vs Địa — Góc nhìn Sự biến đổi Xã hội",
        "scenario": "Một làng nghề truyền thống gốm sứ 500 năm tuổi đang đứng trước nguy cơ mai một trong thời đại số. Em quan tâm nhất tới:",
        "options": [
            {
                "opt": "A",
                "text": "Ghi lại những câu chuyện đời, tâm tư trăn trở của những nghệ nhân già và viết một thiên phóng sự giàu cảm xúc.",
                "next_id": "Q5C",
                "scores": {"Văn": 4},
            },
            {
                "opt": "B",
                "text": "Lần tìm lịch sử thành lập làng nghề, các sắc phong triều đình và vai trò của làng gốm trong giao thương đường thủy xưa.",
                "next_id": "Q5C",
                "scores": {"Sử": 4},
            },
            {
                "opt": "C",
                "text": "Khảo sát nguồn nguyên liệu đất sét tại địa phương, sự suy giảm tài nguyên và đề xuất quy hoạch cụm làng nghề gắn du lịch sinh thái.",
                "next_id": "Q5C",
                "scores": {"Địa": 4},
            },
            {
                "opt": "D",
                "text": "Xây dựng website quảng bá sản phẩm bằng tiếng Anh ra thị trường quốc tế để bảo tồn di sản.",
                "next_id": "Q5D",
                "scores": {"Anh": 3, "Tin": 2, "Văn": 1},
            },
        ],
    },
    "Q5A": {
        "question_id": "Q5A",
        "phase": 2,
        "title": "Thao tác kỹ thuật Toán - Tin — Công cụ làm việc số hóa",
        "scenario": "Khi chuẩn bị bài thuyết trình về một đề tài khoa học phức tạp, em tự tin nhất khi sử dụng công cụ nào:",
        "options": [
            {
                "opt": "A",
                "text": "Vẽ đồ thị hàm số, dùng GeoGebra mô phỏng chuyển động hình học không gian 3D chuẩn xác từng tọa độ.",
                "next_id": "Q6A",
                "scores": {"Toán": 4, "Tin": 1},
            },
            {
                "opt": "B",
                "text": "Viết chương trình Python / C++ tính toán tự động và vẽ biểu đồ phân phối dữ liệu trực quan.",
                "next_id": "Q6A",
                "scores": {"Tin": 4, "Toán": 2},
            },
            {
                "opt": "C",
                "text": "Mô phỏng vật lý bằng phần mềm chuyên dụng (như Algodoo, PhET) để người xem thấy rõ lực và tương tác.",
                "next_id": "Q6A",
                "scores": {"Lý": 4, "Tin": 2},
            },
            {
                "opt": "D",
                "text": "Thiết kế bảng tính Excel / Google Sheets với các hàm lồng phức tạp để quản lý và phân tích số liệu.",
                "next_id": "Q6A",
                "scores": {"Toán": 2, "Tin": 2, "Địa": 2},
            },
        ],
    },
    "Q5B": {
        "question_id": "Q5B",
        "phase": 2,
        "title": "Thao tác phòng Lab KHTN — Thực nghiệm & Xử lý sai số",
        "scenario": "Khi kết quả một thí nghiệm trong phòng thực hành bị sai lệch so với lý thuyết trong sách giáo khoa, em sẽ làm gì đầu tiên:",
        "options": [
            {
                "opt": "A",
                "text": "Kiểm tra lại độ chính xác của các dụng cụ đo (thước kẹp, đồng hồ bấm giây, cảm biến), tính sai số hệ thống và sai số ngẫu nhiên.",
                "next_id": "Q6A",
                "scores": {"Lý": 4, "Toán": 2},
            },
            {
                "opt": "B",
                "text": "Kiểm tra độ tinh khiết của hóa chất, nồng độ dung dịch, nhiệt độ môi trường và sự xuất hiện của phản ứng phụ.",
                "next_id": "Q6A",
                "scores": {"Hóa": 4},
            },
            {
                "opt": "C",
                "text": "Xem xét lại mẫu sinh học, điều kiện ánh sáng, độ ẩm và các yếu tố sinh lý có thể làm thay đổi phản ứng của sinh vật.",
                "next_id": "Q6A",
                "scores": {"Sinh": 4},
            },
            {
                "opt": "D",
                "text": "Viết code chạy mô phỏng lại toàn bộ quy trình thí nghiệm để đối chiếu xem bước nào dễ gây lỗi nhất.",
                "next_id": "Q6A",
                "scores": {"Tin": 3, "Lý": 2},
            },
        ],
    },
    "Q5C": {
        "question_id": "Q5C",
        "phase": 2,
        "title": "Thao tác tư liệu KHXH — Nguồn tư liệu & Kỹ thuật phân tích",
        "scenario": "Để viết một bài nghiên cứu xã hội đạt chất lượng giải thưởng học sinh giỏi, nguồn tài liệu em tin cậy nhất là:",
        "options": [
            {
                "opt": "A",
                "text": "Các văn bản gốc, tác phẩm văn học kinh điển, bút tích tác giả và những bài phê bình văn học chuẩn mực.",
                "next_id": "Q6B",
                "scores": {"Văn": 4},
            },
            {
                "opt": "B",
                "text": "Châu bản, mộc bản, văn bia lịch sử, các hiệp ước ngoại giao và tài liệu lưu trữ quốc gia.",
                "next_id": "Q6B",
                "scores": {"Sử": 4},
            },
            {
                "opt": "C",
                "text": "Niên giám thống kê tổng cục, bản đồ địa hình quân sự, dữ liệu ảnh vệ tinh GIS và báo cáo khí hậu.",
                "next_id": "Q6B",
                "scores": {"Địa": 4},
            },
            {
                "opt": "D",
                "text": "Phỏng vấn sâu nhân chứng thực tế kết hợp quan sát tham gia đời sống cộng đồng.",
                "next_id": "Q6B",
                "scores": {"Văn": 2, "Sử": 2, "Địa": 2},
            },
        ],
    },
    "Q5D": {
        "question_id": "Q5D",
        "phase": 2,
        "title": "Năng lực ngôn ngữ hội nhập — Ứng dụng trong môi trường đa văn hóa",
        "scenario": "Khi tham gia một diễn đàn thanh niên quốc tế trực tuyến, vai trò nào khiến em phát huy tốt nhất năng lực của mình:",
        "options": [
            {
                "opt": "A",
                "text": "Người phát ngôn (Spokesperson) trình bày quan điểm, diễn thuyết truyền cảm hứng bằng tiếng Anh lưu loát.",
                "next_id": "Q6B",
                "scores": {"Anh": 4, "Văn": 2},
            },
            {
                "opt": "B",
                "text": "Nhà soạn thảo văn kiện (Rapporteur) tổng hợp các ý kiến tranh luận thành bản tuyên bố chung chuẩn xác, trang trọng.",
                "next_id": "Q6B",
                "scores": {"Anh": 4, "Sử": 2},
            },
            {
                "opt": "C",
                "text": "Chuyên gia dữ liệu trình bày các chỉ số thống kê về kinh tế - xã hội các nước bằng biểu đồ trực quan.",
                "next_id": "Q6A",
                "scores": {"Anh": 2, "Địa": 3, "Toán": 1},
            },
            {
                "opt": "D",
                "text": "Điều phối viên kỹ thuật phụ trách phòng họp ảo, công cụ bình chọn và hệ thống tương tác.",
                "next_id": "Q6A",
                "scores": {"Anh": 2, "Tin": 3},
            },
        ],
    },
    "Q6A": {
        "question_id": "Q6A",
        "phase": 2,
        "title": "Dự án KHTN & Công nghệ — Ý tưởng Dự án Khoa học Kỹ thuật",
        "scenario": "Nếu được cấp 20 triệu đồng để làm dự án tham gia cuộc thi KHKT cấp quốc gia, em sẽ chọn hướng nào:",
        "options": [
            {
                "opt": "A",
                "text": "Thiết kế hệ thống cánh tay robot hỗ trợ người khuyết tật ứng dụng trí tuệ nhân tạo và vi điều khiển.",
                "next_id": "Q7",
                "scores": {"Tin": 3, "Lý": 3, "Toán": 1},
            },
            {
                "opt": "B",
                "text": "Nghiên cứu chế tạo màng bọc thực phẩm sinh học tự phân hủy từ tinh bột vỏ sầu riêng.",
                "next_id": "Q7",
                "scores": {"Hóa": 3, "Sinh": 3},
            },
            {
                "opt": "C",
                "text": "Xây dựng thuật toán mật mã lượng tử mô phỏng trên nền tảng máy tính cổ điển.",
                "next_id": "Q7",
                "scores": {"Toán": 4, "Tin": 3},
            },
            {
                "opt": "D",
                "text": "Hệ thống lọc nước biển thành nước ngọt ứng dụng năng lượng mặt trời và ống mao dẫn nano.",
                "next_id": "Q7",
                "scores": {"Lý": 3, "Hóa": 3, "Địa": 1},
            },
        ],
    },
    "Q6B": {
        "question_id": "Q6B",
        "phase": 2,
        "title": "Dự án KHXH & Cộng đồng — Ý tưởng Dự án Xã hội & Nhân văn",
        "scenario": "Nếu chủ trì một dự án truyền thông học đường có sức ảnh hưởng lớn, em sẽ chọn chủ đề nào:",
        "options": [
            {
                "opt": "A",
                "text": "Chiến dịch lan tỏa văn hóa đọc, tổ chức các buổi tọa đàm về vẻ đẹp của ngôn từ và sự thấu cảm trong học đường.",
                "next_id": "Q7",
                "scores": {"Văn": 4, "Anh": 1},
            },
            {
                "opt": "B",
                "text": "Dự án số hóa di tích lịch sử địa phương thành bảo tàng ảo 3D và phụ đề song ngữ Anh - Việt.",
                "next_id": "Q7",
                "scores": {"Sử": 4, "Anh": 2, "Tin": 1},
            },
            {
                "opt": "C",
                "text": "Khảo sát và xây dựng bản đồ số cảnh báo điểm đen rác thải nhựa trong khu dân cư thành phố.",
                "next_id": "Q7",
                "scores": {"Địa": 4, "Tin": 2},
            },
            {
                "opt": "D",
                "text": "Câu lạc bộ tranh biện tiếng Anh về các Mục tiêu Phát triển Bền vững của Liên Hợp Quốc (UN SDGs).",
                "next_id": "Q7",
                "scores": {"Anh": 4, "Địa": 1, "Sử": 1},
            },
        ],
    },
    "Q7": {
        "question_id": "Q7",
        "phase": 3,
        "title": "Tác phong giải quyết vấn đề — Phản xạ trước ngõ cụt học thuật",
        "scenario": "Khi đã dành trọn 2 tiếng giải một bài tập mà vẫn không ra kết quả, phản xạ tự nhiên của em là:",
        "options": [
            {
                "opt": "A",
                "text": "Xóa hết làm lại từ đầu bằng một hướng tiếp cận hoàn toàn mới, kiểm tra lại từng giả thiết xem có bị ngộ nhận điều gì.",
                "next_id": "Q8A",
                "scores": {"Toán": 3, "Lý": 2},
            },
            {
                "opt": "B",
                "text": "Viết chương trình máy tính hoặc lập bảng thử nghiệm các trường hợp nhỏ n = 1, 2, 3... để tìm quy luật ẩn.",
                "next_id": "Q8A",
                "scores": {"Tin": 3, "Toán": 2},
            },
            {
                "opt": "C",
                "text": "Đứng dậy đi dạo, để não bộ ở trạng thái thả lỏng ủ ý tưởng, ghi chép lại những dòng suy nghĩ bất chợt nảy sinh.",
                "next_id": "Q8B",
                "scores": {"Văn": 3, "Sinh": 1},
            },
            {
                "opt": "D",
                "text": "Mở rộng tra cứu tài liệu nước ngoài trên Google Scholar hoặc diễn đàn học thuật quốc tế bằng tiếng Anh.",
                "next_id": "Q8A",
                "scores": {"Anh": 3, "Sử": 1},
            },
        ],
    },
    "Q8A": {
        "question_id": "Q8A",
        "phase": 3,
        "title": "Môi trường Flow Tự nhiên — Điều kiện kích hoạt tập trung cao độ",
        "scenario": "Không gian và điều kiện học tập nào khiến em tập trung cao độ đến mức quên cả thời gian ăn ngủ:",
        "options": [
            {
                "opt": "A",
                "text": "Góc bàn học tĩnh lặng tuyệt đối về đêm, chỉ có cây bút chì, tập giấy nháp trắng và đề thi học sinh giỏi toán/lý.",
                "next_id": "Q9A",
                "scores": {"Toán": 4, "Lý": 3},
            },
            {
                "opt": "B",
                "text": "Trước màn hình máy tính với bộ gõ code, hai tai đeo tai nghe nhạc không lời, liên tục gõ phím và test lệnh.",
                "next_id": "Q9A",
                "scores": {"Tin": 4},
            },
            {
                "opt": "C",
                "text": "Phòng thí nghiệm KHTN với đầy đủ ống nghiệm, cân điện tử, kính hiển vi và những thí nghiệm đang diễn ra.",
                "next_id": "Q9A",
                "scores": {"Hóa": 3, "Sinh": 3, "Lý": 2},
            },
            {
                "opt": "D",
                "text": "Bàn làm việc với một tấm bản đồ lớn, quả địa cầu và các bảng dữ liệu thống kê mở sẵn trên máy tính.",
                "next_id": "Q9B",
                "scores": {"Địa": 4, "Tin": 1},
            },
        ],
    },
    "Q8B": {
        "question_id": "Q8B",
        "phase": 3,
        "title": "Môi trường Flow Xã hội — Không gian sáng tạo & Nghiên cứu Nhân văn",
        "scenario": "Không gian nào đem lại cho em nhiều nguồn cảm hứng nhất để học tập và sáng tạo:",
        "options": [
            {
                "opt": "A",
                "text": "Một quán cà phê sách cổ kính hoặc góc thư viện ngập tràn ánh nắng, mùi giấy thơm và cuốn tiểu thuyết hay.",
                "next_id": "Q9B",
                "scores": {"Văn": 4},
            },
            {
                "opt": "B",
                "text": "Bảo tàng lịch sử với những hiện vật trầm mặc, các bức ảnh tư liệu đen trắng và không khí trang nghiêm.",
                "next_id": "Q9B",
                "scores": {"Sử": 4},
            },
            {
                "opt": "C",
                "text": "Phòng thảo luận nhóm sôi nổi, nơi mọi người tự do phản biện, bảo vệ ý kiến bằng cả tiếng Anh và tiếng Việt.",
                "next_id": "Q9B",
                "scores": {"Anh": 3, "Văn": 2},
            },
            {
                "opt": "D",
                "text": "Không gian mở trên sân thượng nhìn ra toàn cảnh thành phố với những dòng xe cộ tấp nập và quy hoạch đô thị.",
                "next_id": "Q9B",
                "scores": {"Địa": 3, "Văn": 2},
            },
        ],
    },
    "Q9A": {
        "question_id": "Q9A",
        "phase": 3,
        "title": "Nguồn tri thức Tự nhiên — Kênh thông tin tự giác tìm đọc",
        "scenario": "Kênh YouTube hoặc loại sách báo em thường chủ động theo dõi nhiều nhất vào cuối tuần là:",
        "options": [
            {
                "opt": "A",
                "text": "3Blue1Brown, Numberphile (những video trực quan hóa vẻ đẹp kỳ vĩ của toán học đỉnh cao).",
                "next_id": "Q10",
                "scores": {"Toán": 4, "Tin": 2},
            },
            {
                "opt": "B",
                "text": "Veritasium, Kurzgesagt, NileRed (các video giải thích hiện tượng vật lý, phản ứng hóa học thú vị).",
                "next_id": "Q10",
                "scores": {"Lý": 3, "Hóa": 3, "Sinh": 2},
            },
            {
                "opt": "C",
                "text": "Joma Tech, Fireship, CS50 (các kênh về công nghệ, lập trình viên, xu hướng trí tuệ nhân tạo).",
                "next_id": "Q10",
                "scores": {"Tin": 4, "Anh": 1},
            },
            {
                "opt": "D",
                "text": "National Geographic, BBC Earth (các bộ phim tài liệu về thế giới hoang dã, đại dương và địa lý).",
                "next_id": "Q10",
                "scores": {"Sinh": 3, "Địa": 3},
            },
        ],
    },
    "Q9B": {
        "question_id": "Q9B",
        "phase": 3,
        "title": "Nguồn tri thức Xã hội — Thế giới quan & Nguồn cảm hứng Nhân văn",
        "scenario": "Loại ấn phẩm hoặc chương trình nào thu hút sự chú ý của em lâu nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Các tập tản văn sâu sắc, tác phẩm đoạt giải Nobel văn học hoặc các bài phê bình nghệ thuật sâu sắc.",
                "next_id": "Q10",
                "scores": {"Văn": 4},
            },
            {
                "opt": "B",
                "text": "Sách sử ký, hồi ký của các danh nhân lịch sử, tư liệu về các cuộc chiến tranh và bang giao thế giới.",
                "next_id": "Q10",
                "scores": {"Sử": 4},
            },
            {
                "opt": "C",
                "text": "Các podcast TED Talks, The Economist, BBC 6 Minute English về những xu hướng chuyển dịch toàn cầu.",
                "next_id": "Q10",
                "scores": {"Anh": 4, "Địa": 1},
            },
            {
                "opt": "D",
                "text": "Các chuyên đề về địa chính trị, quy hoạch đô thị và biến đổi khí hậu trên tạp chí địa lý.",
                "next_id": "Q10",
                "scores": {"Địa": 4, "Sử": 1},
            },
        ],
    },
    "Q10": {
        "question_id": "Q10",
        "phase": 4,
        "title": "Sức bền học thuật — Thái độ trước bài toán chuyên sâu kéo dài",
        "scenario": "Thầy cô giao một chuyên đề nâng cao yêu cầu nghiên cứu ròng rã suốt 1 tháng. Thái độ thật sự của em là:",
        "options": [
            {
                "opt": "A",
                "text": "Càng khó càng kích thích! Em sẽ không chịu bỏ cuộc cho đến khi tìm ra lời giải triệt để nhất.",
                "next_id": "Q11",
                "scores": {"Toán": 3, "Tin": 3, "Lý": 2},
            },
            {
                "opt": "B",
                "text": "Lên kế hoạch chia nhỏ mục tiêu mỗi ngày, tỉ mỉ thực hiện từng công đoạn thí nghiệm/khảo sát.",
                "next_id": "Q11",
                "scores": {"Hóa": 3, "Sinh": 3, "Địa": 2},
            },
            {
                "opt": "C",
                "text": "Đắm chìm vào việc đọc hàng chục cuốn sách và tài liệu liên quan để bài viết đạt độ dày dặn và chiều sâu.",
                "next_id": "Q11",
                "scores": {"Văn": 3, "Sử": 3},
            },
            {
                "opt": "D",
                "text": "Hào hứng liên hệ kết nối với các bạn giỏi và tham khảo nguồn tài liệu quốc tế để hoàn thiện bài xuất sắc.",
                "next_id": "Q11",
                "scores": {"Anh": 3, "Tin": 2},
            },
        ],
    },
    "Q11": {
        "question_id": "Q11",
        "phase": 4,
        "title": "Năng lực hệ thống hóa — Tổ chức khối lượng tri thức đồ sộ",
        "scenario": "Trước kỳ thi HSG với lượng kiến thức khổng lồ gấp 5 lần chương trình thường, phương pháp ghi nhớ của em là:",
        "options": [
            {
                "opt": "A",
                "text": "Hiểu sâu sắc bản chất và cấu trúc logic cốt lõi. Từ 1 định luật gốc có thể tự suy diễn ra toàn bộ công thức còn lại.",
                "next_id": "Q12",
                "scores": {"Toán": 4, "Lý": 3},
            },
            {
                "opt": "B",
                "text": "Vẽ bản đồ tư duy (Mindmap) nhiều nhánh, kết hợp màu sắc và bảng phân loại hệ thống (bảng tuần hoàn, cây phân loại).",
                "next_id": "Q12",
                "scores": {"Hóa": 3, "Sinh": 3, "Địa": 2},
            },
            {
                "opt": "C",
                "text": "Xây dựng bảng niên biểu dòng thời gian, sơ đồ nguyên nhân - kết quả và rút ra quy luật so sánh.",
                "next_id": "Q12",
                "scores": {"Sử": 4, "Địa": 2},
            },
            {
                "opt": "D",
                "text": "Ghi chép dưới dạng các đoạn văn bình luận súc tích, lưu lại những câu trích dẫn đắt giá và cảm nhận tâm đắc.",
                "next_id": "Q12",
                "scores": {"Văn": 4, "Anh": 2},
            },
        ],
    },
    "Q12": {
        "question_id": "Q12",
        "phase": 4,
        "title": "Kỹ năng mài giũa — Kỹ năng cốt lõi muốn tôi luyện ở trường Chuyên",
        "scenario": "Bước vào môi trường trường Chuyên với những bạn bè xuất sắc nhất, kỹ năng em khát khao mài giũa nhất là:",
        "options": [
            {
                "opt": "A",
                "text": "Tư duy trừu tượng cấp cao, năng lực mô hình hóa toán học và thuật toán giải quyết các bài toán tối ưu cực hạn.",
                "next_id": "Q13A",
                "scores": {"Toán": 4, "Tin": 3},
            },
            {
                "opt": "B",
                "text": "Kỹ năng nghiên cứu khoa học thực nghiệm độc lập, thao tác lab chuẩn mực và năng lực viết báo cáo khoa học.",
                "next_id": "Q13A",
                "scores": {"Lý": 2, "Hóa": 3, "Sinh": 3},
            },
            {
                "opt": "C",
                "text": "Tư duy phản biện (Critical Thinking), năng lực lập luận sắc bén và cảm thụ nhân sinh quan sâu sắc.",
                "next_id": "Q13B",
                "scores": {"Văn": 4, "Sử": 2},
            },
            {
                "opt": "D",
                "text": "Năng lực lãnh đạo toàn cầu, hùng biện quốc tế và kỹ năng nghiên cứu liên ngành trong thế giới phẳng.",
                "next_id": "Q13B",
                "scores": {"Anh": 4, "Địa": 2},
            },
        ],
    },
    "Q13A": {
        "question_id": "Q13A",
        "phase": 5,
        "title": "Nghề nghiệp KHTN & Công nghệ — Bức tranh 10-15 năm tới",
        "scenario": "Hãy tưởng tượng em ở tuổi 25, vị trí công việc nào làm em cảm thấy tự hào và cống hiến nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Kỹ sư Trí tuệ Nhân tạo (AI Engineer) hoặc Kiến trúc sư Hệ thống phần mềm tại các tập đoàn công nghệ lớn.",
                "next_id": "Q14",
                "scores": {"Tin": 4, "Toán": 3},
            },
            {
                "opt": "B",
                "text": "Nhà nghiên cứu Vi mạch Bán dẫn, Kỹ sư Cơ điện tử hoặc Chuyên gia Năng lượng hạt nhân.",
                "next_id": "Q14",
                "scores": {"Lý": 4, "Toán": 2},
            },
            {
                "opt": "C",
                "text": "Bác sĩ Ngoại khoa / Nội khoa, Dược sĩ bào chế thuốc hoặc Nhà khoa học Công nghệ Sinh học Tế bào gốc.",
                "next_id": "Q14",
                "scores": {"Sinh": 4, "Hóa": 3},
            },
            {
                "opt": "D",
                "text": "Kỹ sư Hóa dầu, Vật liệu mới hoặc Chuyên gia Phân tích Dữ liệu Không gian & Môi trường.",
                "next_id": "Q14",
                "scores": {"Hóa": 3, "Địa": 3},
            },
        ],
    },
    "Q13B": {
        "question_id": "Q13B",
        "phase": 5,
        "title": "Nghề nghiệp KHXH & Nhân văn — Bức tranh 10-15 năm tới",
        "scenario": "Hãy tưởng tượng em ở tuổi 25, vai trò xã hội nào thôi thúc ngọn lửa đam mê của em nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Nhà báo điều tra, Nhà văn, Giám đốc Sáng tạo Nội dung hoặc Chuyên gia Truyền thông chiến lược.",
                "next_id": "Q14",
                "scores": {"Văn": 4, "Anh": 1},
            },
            {
                "opt": "B",
                "text": "Nhà Ngoại giao, Chuyên viên Phân tích Chính sách Quốc tế hoặc Luật sư Tranh tụng.",
                "next_id": "Q14",
                "scores": {"Anh": 3, "Sử": 3, "Văn": 2},
            },
            {
                "opt": "C",
                "text": "Nhà nghiên cứu Lịch sử Văn hóa, Quản lý Bảo tàng hoặc Cố vấn Bảo tồn Di sản Thế giới.",
                "next_id": "Q14",
                "scores": {"Sử": 4, "Văn": 2},
            },
            {
                "opt": "D",
                "text": "Chuyên gia Kinh tế Vĩ mô, Nhà Quy hoạch Đô thị hoặc Chuyên gia Biến đổi Khí hậu của Liên Hợp Quốc.",
                "next_id": "Q14",
                "scores": {"Địa": 4, "Anh": 2, "Toán": 1},
            },
        ],
    },
    "Q14": {
        "question_id": "Q14",
        "phase": 5,
        "title": "Hình mẫu truyền cảm hứng — Danh nhân trong lịch sử nhân loại",
        "scenario": "Trong lịch sử nhân loại, cuộc đời và sự nghiệp của danh nhân nào truyền cho em nhiều ngọn lửa nhiệt huyết nhất:",
        "options": [
            {
                "opt": "A",
                "text": "Alan Turing (cha đẻ khoa học máy tính) hoặc Terence Tao / Ngô Bảo Châu (những bộ óc toán học thiên tài).",
                "next_id": "Q15",
                "scores": {"Toán": 4, "Tin": 4},
            },
            {
                "opt": "B",
                "text": "Albert Einstein, Richard Feynman hoặc Marie Curie (những nhà khoa học vật lý - hóa học khai phá vũ trụ).",
                "next_id": "Q15",
                "scores": {"Lý": 4, "Hóa": 3},
            },
            {
                "opt": "C",
                "text": "Charles Darwin (thuyết tiến hóa), Louis Pasteur (y học vi sinh) hoặc Tôn Thất Tùng (bác sĩ đại tài).",
                "next_id": "Q15",
                "scores": {"Sinh": 4, "Hóa": 2},
            },
            {
                "opt": "D",
                "text": "Đại tướng Võ Nguyên Giáp, Chủ tịch Hồ Chí Minh, hoặc các đại văn hào như Lev Tolstoy, Nguyễn Du.",
                "next_id": "Q15",
                "scores": {"Sử": 3, "Văn": 3, "Anh": 2},
            },
        ],
    },
    "Q15": {
        "question_id": "Q15",
        "phase": 5,
        "title": "Đích đến & Động lực nội tại — Lý do chọn trường THPT Chuyên",
        "scenario": "Sau tất cả, lý do sâu sắc nhất khiến em quyết tâm thi đỗ vào một lớp Chuyên trường Chuyên là:",
        "options": [
            {
                "opt": "A",
                "text": "Khát vọng chinh phục những đỉnh cao học thuật, giải các bài toán tầm cỡ Olympic và khẳng định bản lĩnh trí tuệ.",
                "next_id": "END",
                "scores": {"Toán": 3, "Lý": 3, "Tin": 2},
            },
            {
                "opt": "B",
                "text": "Được đắm chìm trong niềm đam mê khoa học thuần khiết, tự do nghiên cứu, làm thí nghiệm và sáng tạo không giới hạn.",
                "next_id": "END",
                "scores": {"Hóa": 3, "Sinh": 3, "Lý": 2},
            },
            {
                "opt": "C",
                "text": "Môi trường bạn bè cùng chí hướng, mở rộng tầm nhìn nhân văn, nuôi dưỡng tâm hồn và bản lĩnh sống tử tế.",
                "next_id": "END",
                "scores": {"Văn": 3, "Sử": 3, "Địa": 2},
            },
            {
                "opt": "D",
                "text": "Tấm vé hội nhập toàn cầu, săn học bổng du học quốc tế và chuẩn bị hành trang trở thành công dân toàn cầu.",
                "next_id": "END",
                "scores": {"Anh": 4, "Tin": 2, "Địa": 1},
            },
        ],
    },
}


def tinh_max_possible() -> dict[str, int]:
    """Tính điểm thô tối đa lý thuyết cho mỗi môn trên mọi đường đi 15 bước hợp lệ."""
    memo = {}

    def _dp(qid: str, mon: str) -> int:
        if qid == "END":
            return 0
        key = (qid, mon)
        if key in memo:
            return memo[key]
        best = max(
            opt["scores"].get(mon, 0) + _dp(opt["next_id"], mon)
            for opt in QUESTION_BANK[qid]["options"]
        )
        memo[key] = best
        return best

    return {mon: _dp("Q1", mon) for mon in CHUYEN_9_MON}


MAX_POSSIBLE = tinh_max_possible()


def cham_diem_re_nhanh(answers: list[dict]) -> tuple[dict[str, float], dict[str, float], dict[str, dict[int, float]], list[dict]]:
    """
    Chạy lại lộ trình 15 câu từ Q1 để tính raw_scores, survey_norm và điểm từng tầng (1..5).
    Trả về: (raw_scores, survey_norm, phase_scores, trace)
    """
    if len(answers) != 15:
        raise ValueError(f"Cần trả lời đúng 15 câu hỏi rẽ nhánh (hiện có {len(answers)}).")

    raw = {m: 0.0 for m in CHUYEN_9_MON}
    phase_scores = {m: {p: 0.0 for p in range(1, 6)} for m in CHUYEN_9_MON}
    trace = []
    cur_id = "Q1"

    for step_idx, ans in enumerate(answers, start=1):
        if cur_id == "END" or cur_id not in QUESTION_BANK:
            raise ValueError(f"Lộ trình câu hỏi không hợp lệ ở bước {step_idx} (qid={cur_id}).")

        q = QUESTION_BANK[cur_id]
        req_qid = ans.get("qId") or cur_id
        if req_qid != cur_id:
            raise ValueError(f"Bước {step_idx} phải là câu {cur_id} nhưng nhận {req_qid}.")

        chosen = (ans.get("opt") or "").strip().upper()
        opt_obj = next((o for o in q["options"] if o["opt"] == chosen), None)
        if not opt_obj:
            raise ValueError(f"Đáp án không hợp lệ ở câu {cur_id}: {chosen}")

        for mon, pts in opt_obj["scores"].items():
            raw[mon] += pts
            phase_scores[mon][q["phase"]] += pts

        trace.append({
            "step": step_idx,
            "qId": cur_id,
            "phase": q["phase"],
            "opt": chosen,
            "scores": opt_obj["scores"],
        })
        cur_id = opt_obj["next_id"]

    if cur_id != "END":
        raise ValueError(f"Sau 15 câu lộ trình chưa kết thúc (đang dừng ở {cur_id}).")

    survey_norm = {
        m: min(100.0, (raw[m] / MAX_POSSIBLE[m]) * 100.0) if MAX_POSSIBLE[m] > 0 else 0.0
        for m in CHUYEN_9_MON
    }
    return raw, survey_norm, phase_scores, trace
