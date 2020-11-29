var navg = $(".navigators");
c = 0;

$(".next").click(function next() {
    navg[c].style.backgroundColor = "gray";
    c++;
    c = c % 7;
    navg[c].style.backgroundColor = "#357CCC";
});
$(".prev").click(function next() {
    navg[c].style.backgroundColor = "gray";
    c--;
    if (c < 0) c = c + 7;
    c = c % 7;
    navg[c].style.backgroundColor = "#357CCC";
});
