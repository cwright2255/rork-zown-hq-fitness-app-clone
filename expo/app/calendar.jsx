import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const DAYS = ['S','M','T','W','T','F','S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const ACTIVITIES = {
  3:[{title:'Morning Run',time:'6:30 AM',type:'Running'},{title:'HIIT Workout',time:'12:00 PM',type:'Workout'},{title:'Meal: Chicken Salad',time:'1:00 PM',type:'Nutrition'}],
  1:[{title:'Strength Training',time:'7:00 AM',type:'Workout'}],
  5:[{title:'5K Tempo Run',time:'6:00 AM',type:'Running'}],
  8:[{title:'Yoga Flow',time:'8:00 AM',type:'Workout'}],
};
const ACTIVITY_DAYS = new Set(Object.keys(ACTIVITIES).map(Number));

const UPCOMING = [
  {date:'Jun 4',title:'Morning Run',time:'6:30 AM'},
  {date:'Jun 5',title:'5K Tempo Run',time:'6:00 AM'},
  {date:'Jun 8',title:'Yoga Flow',time:'8:00 AM'},
];

function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function getFirstDayOfMonth(y,m){return new Date(y,m,1).getDay();}

export default function CalendarScreen(){
  const [year,setYear]=useState(2026);
  const [month,setMonth]=useState(5); // June
  const [selectedDay,setSelectedDay]=useState(3);

  const daysInMonth=getDaysInMonth(year,month);
  const firstDay=getFirstDayOfMonth(year,month);
  const today=3;

  const weeks=useMemo(()=>{
    const cells=[];
    for(let i=0;i<firstDay;i++) cells.push(null);
    for(let d=1;d<=daysInMonth;d++) cells.push(d);
    const rows=[];
    for(let i=0;i<cells.length;i+=7) rows.push(cells.slice(i,i+7));
    if(rows[rows.length-1].length<7) while(rows[rows.length-1].length<7) rows[rows.length-1].push(null);
    return rows;
  },[year,month]);

  const prevMonth=()=>{if(month===0){setMonth(11);setYear(year-1);}else setMonth(month-1);setSelectedDay(1);};
  const nextMonth=()=>{if(month===11){setMonth(0);setYear(year+1);}else setMonth(month+1);setSelectedDay(1);};

  const dayActivities=ACTIVITIES[selectedDay]||[];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.logoRow}><Image source={require('@/assets/branding/zown-logo-512.png')} style={s.logo} resizeMode="contain" /></View>
        <Text style={s.pageTitle}>Calendar</Text>

        {/* Month nav */}
        <View style={s.monthRow}>
          <Pressable onPress={prevMonth}><Ionicons name="chevron-back" size={22} color="#000" /></Pressable>
          <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
          <Pressable onPress={nextMonth}><Ionicons name="chevron-forward" size={22} color="#000" /></Pressable>
        </View>

        {/* Calendar grid */}
        <View style={s.calCard}>
          <View style={s.dayHeaders}>{DAYS.map((d,i)=><Text key={i} style={s.dayHeader}>{d}</Text>)}</View>
          {weeks.map((row,ri)=>(
            <View key={ri} style={s.weekRow}>
              {row.map((d,ci)=>(
                <Pressable key={ci} style={[s.dayCell,d===selectedDay&&s.dayCellSelected,d===today&&d!==selectedDay&&s.dayCellToday]} onPress={()=>d&&setSelectedDay(d)}>
                  {d?<><Text style={[s.dayText,d===selectedDay&&s.dayTextSelected]}>{d}</Text>{ACTIVITY_DAYS.has(d)&&<View style={[s.activityDot,d===selectedDay&&{backgroundColor:'#FFF'}]} />}</>:null}
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        {/* Selected day details */}
        <Text style={s.sectionTitle}>{MONTHS[month]} {selectedDay}, {year}</Text>
        {dayActivities.length>0?dayActivities.map((a,i)=>(
          <View key={i} style={s.actRow}>
            <View style={s.actIcon}><Ionicons name={a.type==='Running'?'fitness-outline':a.type==='Workout'?'barbell-outline':'nutrition-outline'} size={16} color="#000" /></View>
            <View style={s.actInfo}><Text style={s.actTitle}>{a.title}</Text><Text style={s.actTime}>{a.time}</Text></View>
            <View style={[s.actBadge,a.type==='Running'&&{backgroundColor:'#333'}]}><Text style={s.actBadgeText}>{a.type}</Text></View>
          </View>
        )):<Text style={s.noAct}>No activities logged</Text>}
        <Pressable style={s.addActBtn}><Ionicons name="add" size={18} color="#999" /><Text style={s.addActText}>Add Activity</Text></Pressable>

        {/* Upcoming */}
        <Text style={[s.sectionTitle,{marginTop:20}]}>Upcoming</Text>
        {UPCOMING.map((u,i)=>(
          <View key={i} style={s.upRow}><Text style={s.upDate}>{u.date}</Text><Text style={s.upTitle}>{u.title}</Text><Text style={s.upTime}>{u.time}</Text></View>
        ))}

        {/* Quick log */}
        <Text style={[s.sectionTitle,{marginTop:20}]}>Quick Log</Text>
        <View style={s.quickRow}>
          {[{icon:'barbell-outline',label:'Log Workout',route:'/workouts'},{icon:'fitness-outline',label:'Log Run',route:'/running/program'},{icon:'nutrition-outline',label:'Log Meal',route:'/nutrition/log'},{icon:'heart-outline',label:'Log Health',route:'/health'}].map(q=>(
            <Pressable key={q.label} style={s.quickItem} onPress={()=>router.push(q.route)}>
              <View style={s.quickCircle}><Ionicons name={q.icon} size={20} color="#000" /></View>
              <Text style={s.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'}, scroll:{flex:1}, scrollContent:{paddingBottom:100},
  logoRow:{alignItems:'center',marginTop:8,marginBottom:12}, logo:{width:120,height:36},
  pageTitle:{fontSize:24,fontWeight:'800',color:'#000',paddingHorizontal:20,marginBottom:8},
  monthRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:12},
  monthLabel:{fontSize:18,fontWeight:'700',color:'#000'},
  calCard:{backgroundColor:'#FFF',borderRadius:16,padding:12,marginHorizontal:20,marginBottom:20,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}},android:{elevation:3},default:{shadowColor:'#000',shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2}}})},
  dayHeaders:{flexDirection:'row',marginBottom:8},
  dayHeader:{flex:1,textAlign:'center',fontSize:12,fontWeight:'600',color:'#999'},
  weekRow:{flexDirection:'row'},
  dayCell:{flex:1,alignItems:'center',paddingVertical:8,borderRadius:20,minHeight:40,justifyContent:'center'},
  dayCellSelected:{backgroundColor:'#000'},
  dayCellToday:{borderWidth:1,borderColor:'#000'},
  dayText:{fontSize:14,fontWeight:'500',color:'#000'},
  dayTextSelected:{color:'#FFF',fontWeight:'700'},
  activityDot:{width:4,height:4,borderRadius:2,backgroundColor:'#000',marginTop:2},
  sectionTitle:{fontSize:18,fontWeight:'700',color:'#000',paddingHorizontal:20,marginBottom:12},
  actRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  actIcon:{width:36,height:36,borderRadius:18,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  actInfo:{flex:1,marginLeft:12},
  actTitle:{fontSize:14,fontWeight:'600',color:'#000'},
  actTime:{fontSize:12,color:'#999',marginTop:2},
  actBadge:{backgroundColor:'#000',paddingHorizontal:8,paddingVertical:3,borderRadius:8},
  actBadgeText:{fontSize:10,fontWeight:'700',color:'#FFF'},
  noAct:{fontSize:14,color:'#999',paddingHorizontal:20,marginBottom:12},
  addActBtn:{flexDirection:'row',alignItems:'center',gap:6,marginHorizontal:20,marginTop:8,marginBottom:20,borderWidth:1,borderColor:'#E5E5E5',borderStyle:'dashed',borderRadius:12,padding:14,justifyContent:'center'},
  addActText:{fontSize:14,color:'#999'},
  upRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  upDate:{fontSize:13,fontWeight:'700',color:'#000',width:50},
  upTitle:{flex:1,fontSize:14,fontWeight:'600',color:'#000'},
  upTime:{fontSize:12,color:'#999'},
  quickRow:{flexDirection:'row',justifyContent:'space-around',paddingHorizontal:20,marginBottom:24},
  quickItem:{alignItems:'center'},
  quickCircle:{width:48,height:48,borderRadius:24,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  quickLabel:{fontSize:11,fontWeight:'600',color:'#000',marginTop:6,textAlign:'center'},
});
