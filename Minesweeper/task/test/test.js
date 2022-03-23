const puppeteer = require('puppeteer');
const path = require('path');
// '..' since we're in the test/ subdirectory; learner is supposed to have src3/index.html
// const pagePath = 'file://' + path.resolve(__dirname, '../src3/index.html');

const hs = require('hs-test-web');
const react = require("hs-test-web-server");

const sleep = (ms) => new Promise(res => setTimeout(res , ms));


async function stageTest() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--disable-infobar'],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    let result;

    const page = await browser.newPage();
    await page.goto('http://localhost:31328');
    await page.setDefaultNavigationTimeout(0);

    page.on('console', msg => console.log(msg.text()));
    result = await hs.testPage(page,

        () => {
            this.eventFire = function (e, type) {
                let event = document.createEvent('Event');
                event.initEvent(type, true, false);
                e.dispatchEvent(event);
            };

            this.getCellByClass = function (clName, i) {
                return document.getElementsByClassName(clName)[i]
            };

            this.isCellWithPicture = function (cell) {
                let backgroundImage = window.getComputedStyle(cell).backgroundImage;
                return cell.children.length > 0 && cell.children[0].tagName.toLowerCase() === "img" ||
                    backgroundImage !== "none";
            };

            this.elements = {
                flagCounter: undefined,
                resetBtn: undefined,
                clock: undefined
            };

            this.divs = new Map();
            let hoverClasses = new Map();
            Array.from(document.getElementsByTagName("*")).forEach(element => {
                if (element.children.length > 1 ||
                    element.tagName === "SCRIPT" ||
                    element.tagName === "LINK" ||
                    element.tagName === "META" ||
                    element.tagName === "STYLE" ||
                    element.tagName === "NOSCRIPT") return;

                let text = element.innerText;

                if (text.includes('10'))
                    this.elements.flagCounter = element;
                if (text.includes('0:00'))
                    this.elements.clock = element;
                if (text === '') {
                    let width = window.getComputedStyle(element).width;
                    let height = window.getComputedStyle(element).height;
                    let divName = element.className;

                    if (width === height)
                        this.divs.has(divName) ?
                            this.divs.set(divName, this.divs.get(divName) + 1) :
                            this.divs.set(divName, 1)
                }

                if (window.getComputedStyle(element).cursor === "pointer" && element.className !== "cell") {
                    this.elements.resetBtn = element;
                }
            });

            if (!this.elements.flagCounter) {
                return hs.wrong("There should be a flag counter that equals to '10'.")
            }
            if (this.elements.resetBtn === undefined) {
                return hs.wrong("There should be a reset button and if you hover the mouse over it, the cursor should change to the pointer.")
            }

            if (!this.elements.clock) {
                return hs.wrong("There should be a timer that equals to '0:00'.")
            }

            return hs.correct()
        },
        () => {
            this.divs = Array.from(this.divs);
            let cellClass = this.divs.find(([k, v]) => v === 72);

            if (!cellClass) {
              return hs.wrong("The field should contain 72 cells with no inner elements inside.")
            }

            return hs.correct()
        },
        () => {
            let cells = Array.from(document.getElementsByClassName("cell"));

            if (cells.length === 0) {
                return hs.wrong("Cells should have className='cell'");
            }

            let rows = new Map();
            let columns = new Map();
            cells.forEach(cell => {
                let top = cell.getBoundingClientRect().top;
                let left = cell.getBoundingClientRect().left;

                rows.has(top) ?
                    rows.set(top, rows.get(top) + 1) :
                    rows.set(top, 1);

                columns.has(left) ?
                    columns.set(left, columns.get(left) + 1) :
                    columns.set(left, 1)
            });

            rows = Array.from(rows);
            let isWrongRow = rows.find(([k, v]) => v !== 8);
            if (isWrongRow) return hs.wrong("Each row of the field should contain 8 cells.");

            columns = Array.from(columns);
            let isWrongColumn = columns.find(([k, v]) => v !== 9);
            if (isWrongColumn) return hs.wrong("Each column of the field should contain 9 cells.")

            return hs.correct()
        },
        async () => {
            /*
        тест счётчика:
            1)клик правой кнопкой на 2 => 8 в счётчике
            2)                ещё на 8 => 0 в счётчике
            3)                попробовать ещё => ничего не изменяется*/


            let arr = [58, 65];
            let res = true;
            arr.forEach((i, ind) => {
                let cell = this.getCellByClass("cell", i);
                this.eventFire(cell, 'contextmenu');
                if (!this.isCellWithPicture(cell)) res = false
            });
            if (!res) return hs.wrong("The flagged cell should look different.");

            if (!this.elements.flagCounter.innerText.includes("8"))
                return hs.wrong("The flag counter should decrease if you flag the cells.");

            arr = [3,8,14,22,35,38,41,55];
            arr.forEach((i, ind) => {
                let cell = this.getCellByClass("cell", i);
                this.eventFire(cell, 'contextmenu');
            });

            if (!this.elements.flagCounter.innerText.includes("0"))
                return hs.wrong("The flag counter should be 0 if all 10 flags are placed.")

            let zeroCounter = this.elements.flagCounter.innerText;
            arr = [61, 70];
            arr.forEach((i, _) => {
                let cell = this.getCellByClass("cell", i);
                this.eventFire(cell, 'contextmenu');
                if (this.isCellWithPicture(cell)) res = false
            });

            if (!res) return hs.wrong("If you placed all 10 flags, you can't flag cells any more.")

            if (this.elements.flagCounter.innerText !== zeroCounter)
                return hs.wrong("The flag counter should be 0 if all 10 flags are placed and you try to flag more cells.")

            return hs.correct();
        },
        () => {
            /*тест таймера:
                1)клик на любую клетку => время пошло
            - случай когда с 1 клика на бомбу => время стоит => проверим есть ли картинка + => перезагрузить страницу и ещё раз

            2)нажимать на все клетки, пока время не остановится (нашли бомбу)
            Если время не остановилось => или таймер не правильный
            или бомб не было(у всех клеток нет background-image или ребенка картинки )*/

            let arr = [58, 65,3,8,14,22,35,38,41,55 ];
            arr.forEach((i, ind) => {
                let cell = this.getCellByClass("cell", i);
                this.eventFire(cell, 'contextmenu');
            });
            let cell = this.getCellByClass("cell", 0);
            cell.click();


            return hs.correct();
        },
        async () => {
            let cell = this.getCellByClass("cell", 0);
            let backgroundImage = window.getComputedStyle(cell).backgroundImage
            if (backgroundImage !== 'none' ||
                cell.children.length > 0 && cell.children[0].tagName.toLowerCase() === 'img'
            ) {
                return hs.wrong("The first click was on the mine! The field should be reloaded in this case.")
            }


            return hs.correct()
        },
        () => {
            return new Promise((resolve) => {
                window.setTimeout(() => {
                    if (this.elements.clock.innerText === "0:00") {
                        resolve(hs.wrong("The timer didn't launch when the first click was commited."))
                    }

                    resolve(hs.correct())
                }, 3000)
            })
        },
        //#test 10
        async () => {
            let k = 0;
            for ( let i = 0; i < 72; i++) {
                let cell = document.getElementsByClassName("cell")[i];
                let timerBefore = this.elements.clock.innerText;
                let backgroundImage = window.getComputedStyle(cell).backgroundImage;
                cell.click();
                await setTimeout(() => {}, 300);

                if (cell.children.length > 0 && cell.children[0].tagName.toLowerCase() === 'img' ||
                    window.getComputedStyle(cell).backgroundImage !== "none"
                ) {
                    k++;
                }

            }

            if ( k === 10) {
                let timerBefore = this.elements.clock.innerText;
                return new Promise(resolve => {
                    setTimeout(() => {
                        if (this.elements.clock.innerText !== timerBefore) {
                            resolve(hs.wrong("The timer should stop when you click on the cell with mine."))
                        }

                        resolve(hs.correct())
                    }, 1000)

                })
            } else return hs.wrong("There should be 10 mines on the field, found " + k);
        },
        async () => {
            /*

            тест: идём по всем клеткам, делаем проверку, если клетка открытая
             (клик по ней правой кнопкой ничего не меняет),то  дальше проверяем:

            если клетка пустая, то вокруг неё все клетки открытые или с цифрами

            если клетка с цифрой, рядом с ней найдётся хотя бы одна закрытая

            если клетка с бомбой, то вокруг неё только клетки с цифрами >= 1 или закрытые
            * */

            let getCellByClass = this.getCellByClass;
            let eventFire = this.eventFire;
            let isCellWithPicture = this.isCellWithPicture;
            let cell = document.getElementsByClassName("cell")[0];
            let border = window.getComputedStyle(cell).border;
            let outline = window.getComputedStyle(cell).outline;
            let backgroundColor = window.getComputedStyle(cell).backgroundColor;

            function isClosedCell (cell) {
                let cellBorder = window.getComputedStyle(cell).border;
                let cellOutline = window.getComputedStyle(cell).outline;
                let cellBackgroundCol = window.getComputedStyle(cell).backgroundColor;
                if (outline !== cellOutline || border !== cellBorder || backgroundColor !== cellBackgroundCol) return true;

                return false
            }

            function isOk (i, row, col) {
                return !(row === 0 && col === 0) &&
                    i + row * 8 + col >= 0 &&
                    i % 8 + col >= 0 && Math.floor(i/8) + row >= 0 &&
                    i % 8 + col < 8 &&  Math.floor(i/8) + row < 9
            }

            async function checkCell(i) {
                let cell = getCellByClass("cell", i)

                if (!isCellWithPicture(cell)) {
                    //console.log("checking cell ",i)
                    if (isClosedCell(cell)){
                        //console.log(i," is closed")

                        return true
                    } else {
                        if (cell.innerText) {
                            //with number
                            for (let row = -1; row <= 1; row++) {
                                for (let col = -1; col <= 1; col++) {
                                    if (isOk(i,row,col)) {
                                        //console.log(i+ row * 8 +col)
                                        let checkCell = getCellByClass("cell",i + row * 8 + col)
                                        if ( isClosedCell(checkCell) || isCellWithPicture(checkCell)) return true
                                    }
                                }
                            }
                            return false
                        } else {
                            //opened empty
                            for (let row = -1; row <= 1; row++) {
                                for (let col = -1; col <= 1; col++) {
                                    if (isOk(i,row,col)) {
                                        //console.log(i + row * 8 + col)
                                        let checkCell = getCellByClass("cell",i + row * 8 + col)
                                        if (isClosedCell(checkCell) || isCellWithPicture(checkCell)) return false
                                    }
                                }
                            }
                            return true
                        }
                    }
                } else {

                    //bomb check
                    for (let row = -1; row <= 1; row++) {
                        for (let col = -1; col <= 1; col++) {
                            if (isOk(i,row,col)) {
                                let checkCell = getCellByClass("cell",i + row * 8 + col)
                                //console.log(i + row * 8 + col)
                                if (!isClosedCell(checkCell) && !checkCell.innerText && !isCellWithPicture(checkCell)) return false
                            }
                        }
                    }

                    return true
                }
            }

            for (let i=0; i<72; i++) {
                let res = await checkCell(i);
                if (!res) return hs.wrong("If you clicked on a cell with n mines around it, it should show n.\n" +
                    "If you clicked on a cell with no bombs around it, it should open an area.")
            }

            return hs.correct()
        },
        () => {
            this.elements.resetBtn.click();
            for (let i=0; i<8; i++) {
                let cell = this.getCellByClass("cell", i);
                if (cell.innerText) {
                    return hs.wrong("The reset button doesn't work!")
                }
            }
            return hs.correct()
        }

    );

    await sleep(15000);
    await browser.close();
    return result
}

jest.setTimeout(180000);
test("Test stage", async () => {
    let result = await react.startServerAndTest(
        'localhost', 31328, path.resolve(__dirname, '..'), stageTest
    );

    if (result['type'] === 'wrong') {
        throw new Error(result['message']);
    }
});
