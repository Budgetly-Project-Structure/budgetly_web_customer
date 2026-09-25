import java.util.Scanner; 

public class StudentGradeManager {
    public static void main(String[] args){
    String[] students = {"Alice", "Bob", "Charlie", "Diana", "Ethan"};
    int[] grades = {92, 76, 88, 64, 95};
    int input = 0;

    while(input != 6){
    System.out.println("1. Display all students");
    System.out.println("2. Find a student");
    System.out.println("3. Find highest grade");
    System.out.println("4. Calculate average");
    System.out.println("5. Count passing students");
    System.out.println("6. Exit");
    

    System.out.println("");
    System.out.print("Enter a number to proceed: ");
    Scanner keybd = new Scanner(System.in);
    input = keybd.nextInt();

    switch(input){
        case 1: 
            System.out.println("Displaying all students: ");
            displayStudents(students, grades);
            break;
        case 2:
            System.out.println("Finding student: " + findStudent(students, "Charlie"));
            break;
        case 3:
            System.out.println("Finding highest grade: " + highestGrade(grades));
            break;
        case 4:
            System.out.println("The amount of students passing: " + countPassing(grades));
            break;
        case 5:
            System.out.println("The average grade in the class is: " + calculateAverage(grades));
            break;
        case 6: break;

        default:
            break;
    }
    }
    }



    public static void displayStudents(String[] students, int[] grades){
        for(int i = 0; i < students.length; i ++){
            System.out.println(students[i] + ": " + grades[i]);
        }
    }

    public static int findStudent(String[] students, String target){
        int foundStudent = -1;
        for(int i = 0; i < students.length; i++){
            String currentStudent = students[i];
            if(currentStudent.equals(target)){
                foundStudent = i;
                break;
            }
        
        }
        return foundStudent;
    }

        public static int highestGrade(int[] grades){
        int currentHighest = grades[0];
        for(int i = 0; i < grades.length; i++){
            if(grades[i] > currentHighest){
                currentHighest = grades[i];
            }
        }
        return currentHighest;
    }

    public static int countPassing(int[] grades){
        int studentsPassing = 0;
        for(int i = 0; i < grades.length; i++){
            if(grades[i] >= 70){
                studentsPassing++;
            }
        }
        return studentsPassing;
    }

    public static double calculateAverage(int[] grades){
        double sum = 0;
        for(int i = 0; i < grades.length; i++){
            sum += grades[i];
        }
        double average = sum/grades.length;
        return average;
    }
}
